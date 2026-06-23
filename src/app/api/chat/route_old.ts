import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { question, analysisResult, service1Log, service2Log } =
            await req.json();

        if (!question || !question.trim()) {
            return Response.json({ error: "問題不可為空" }, { status: 400 });
        }

        // 沒額度時可先打開這段測 UI
        /*
        return Response.json({
          answer: `根據目前分析，最可能原因是 service2 的 SQL timeout，導致 service1 等待 payment-service 回應時發生 read timeout。`,
        });
        */

        const prompt = `
你是一位資深分散式系統 Debug 工程師。
使用者已經分析過 log，現在要針對分析結果繼續追問。

請根據以下資訊回答，不要胡亂猜測。
如果資訊不足，請說「目前 log 資訊不足」。

請用繁體中文回答，並盡量給具體修法。

## 使用者問題
${question}

## 目前分析結果
${analysisResult || "無"}

## service1 log
${(service1Log || "").slice(0, 6000)}

## service2 log
${(service2Log || "").slice(0, 6000)}
`;

        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        });

        return Response.json({
            answer: response.choices[0].message.content,
        });
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