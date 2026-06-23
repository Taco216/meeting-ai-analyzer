import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

const mockSuggestions = [
    "真正的 Root Cause 是哪個服務？",
    "為什麼 service1 也會 timeout？",
    "SQL timeout 要怎麼修？",
    "這個問題會影響哪些 API？",
];

const mockAnswer =
    "根據目前分析，最可能的 Root Cause 是 service2 的資料庫查詢 timeout。service1 timeout 是後續影響，因為它等待 service2 回應但沒有收到結果。建議先檢查 service2 的 SQL、index 與 connection pool。";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const {
            mode,
            result,
            service1Log,
            service2Log,
            messages,
        }: {
            mode?: string;
            result?: string;
            service1Log?: string;
            service2Log?: string;
            messages?: ChatMessage[];
        } = body;

        if (mode === "suggest") {
            if (!process.env.OPENAI_API_KEY) {
                return Response.json({ suggestions: mockSuggestions });
            }

            const prompt = `
根據以下 Log 分析結果，產生 3~5 個工程師可能會追問的 Debug 問題。
請只輸出問題，每行一個，不要解釋。

分析結果：
${result || ""}
`;

            try {
                const response = await client.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: prompt }],
                });

                const text = response.choices[0].message.content || "";

                const suggestions = text
                    .split("\n")
                    .map((line) => line.replace(/^[\d\-\.\s]+/, "").trim())
                    .filter(Boolean);

                return Response.json({
                    suggestions: suggestions.length > 0 ? suggestions : mockSuggestions,
                });
            } catch (error: unknown) {
                console.error("OpenAI suggest error:", error);
                return Response.json({ suggestions: mockSuggestions });
            }
        }

        if (!process.env.OPENAI_API_KEY) {
            return Response.json({ answer: mockAnswer });
        }

        const systemPrompt = `
你是一位資深分散式系統 Debug 工程師。

回答規則：
- 用繁體中文
- 不要亂猜
- 如果資訊不足，請明確說資訊不足
- 優先判斷 Root Cause
- 提供具體修復方向
`;

        const openaiMessages = [
            {
                role: "system" as const,
                content: systemPrompt,
            },
            {
                role: "user" as const,
                content: `
## 分析結果
${result || ""}

## service1 log
${(service1Log || "").slice(0, 4000)}

## service2 log
${(service2Log || "").slice(0, 4000)}
`,
            },
            ...(messages || []).map((m) => ({
                role: m.role,
                content: m.content,
            })),
        ];

        try {
            const response = await client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: openaiMessages,
            });

            return Response.json({
                answer: response.choices[0].message.content || mockAnswer,
            });
        } catch (error: unknown) {
            console.error("OpenAI chat error:", error);
            return Response.json({ answer: mockAnswer });
        }
    } catch (error: unknown) {
        console.error("Chat API error:", error);
        return Response.json({ error: "Chat 失敗" }, { status: 500 });
    }
}