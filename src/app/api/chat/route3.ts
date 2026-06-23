import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { messages, result, service1Log, service2Log } =
            await req.json();

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
            messages: chatMessages,
        });

        return Response.json({
            answer: res.choices[0].message.content,
        });

        // return Response.json({
        //     answer: "這是我的回應",
        // });
    } catch (error: any) {
        console.error("🔥 CHAT ERROR:", error);

        if (error?.code === "insufficient_quota") {
            return Response.json(
                { error: "OpenAI API 額度不足，請先檢查 Billing。" },
                { status: 500 }
            );
        }

        return Response.json(
            { error: error.message || "Chat 失敗" },
            { status: 500 }
        );
    }
}