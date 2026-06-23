import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { messages, result, mode, service1Log, service2Log } =
            await req.json();

        // AI 動態產生建議問題
        if (mode === "suggest") {
            const prompt = `
                你是一位資深工程師。
                
                根據以下 log 分析結果，
                請產生 3~5 個「使用者可能會問的問題」。
                要求：
                - 用繁體中文
                - 每個問題簡短
                - 不要解釋，只輸出問題
                - 每行一個問題
                
                分析結果：
                ${result}
                `;

            const res = await client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
            });

            const text = res.choices[0].message.content || "";

            return Response.json({
                suggestions: text
                    .split("\n")
                    .map((q) => q.replace(/^[\d\-\.\s]+/, "").trim())
                    .filter(Boolean),
            });
        }

        const systemPrompt = `
你是一位資深分散式系統 Debug 工程師。

請根據：
1. log 分析結果
2. 原始 log
3. 使用者問題

提供精準回答。

規則：
- 用繁體中文
- 不要亂猜
- 如果資訊不足要說明
- 優先找 Root Cause
- 提供可執行的修復建議
    `;

        const chatMessages = [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: `
## 分析結果
${result}

## service1 log
${service1Log?.slice(0, 4000)}

## service2 log
${service2Log?.slice(0, 4000)}
`,
            },
            ...messages,
        ];

        const res = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: chatMessages as never,
        });

        return Response.json({
            answer: res.choices[0].message.content,
        });
    } catch (error: any) {
        console.error("🔥 ERROR:", error);

        // 🔹 特別處理 quota
        if (error?.code === "insufficient_quota") {
            return Response.json(
                {
                    error: "OpenAI API 額度不足，請到 Billing 設定",
                },
                { status: 500 }
            );
        }
        return Response.json({ error: error.message }, { status: 500 });
    }
}