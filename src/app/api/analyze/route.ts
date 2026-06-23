import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

type LogInput = {
    serviceName: string;
    content: string;
};

const mockResult = `## Error Pattern
- DB Timeout
- API Timeout

## Root Cause Confidence
86

## 跨服務錯誤摘要
service2 發生 SQL timeout，導致 service1 呼叫 service2 時等待逾時。

## Timeline
- [service1] 10:01:01 收到 POST /api/orders 請求
- [service1] 10:01:02 呼叫 service2 payment API
- [service2] 10:01:03 查詢 transaction table
- [service2] 10:01:07 發生 SQL timeout
- [service1] 10:01:08 收到 service2 timeout 錯誤

## Root Cause
service2 查詢資料庫過慢，造成 SQL timeout，service1 因等待 service2 回應而 timeout。

## 修復建議
1. 檢查 transaction table 是否缺少 index
2. 優化 SQL 查詢條件
3. 檢查 DB connection pool 是否不足
4. service1 可加入 retry / timeout fallback 機制

## Jira Ticket
### Title
Fix payment-service SQL timeout causing order failure

### Description
Order creation fails because payment-service times out while querying the database.

### Priority
High`;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const logs: LogInput[] = body.logs || [];

        const validLogs = logs.filter((x) => x.content?.trim());

        if (validLogs.length === 0) {
            return Response.json({ error: "請至少輸入一份 log" }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return Response.json({ result: mockResult });
        }

        const mergedLogs = validLogs
            .map(
                (log) => `
===== ${log.serviceName} LOG START =====
${log.content.slice(0, 6000)}
===== ${log.serviceName} LOG END =====
`
            )
            .join("\n");

        const prompt = `
你是一位資深分散式系統工程師，請分析以下多服務 log。

請嚴格用 Markdown 格式輸出：

## Error Pattern
請判斷錯誤類型，只能選 1~3 個：
- DB Timeout
- API Timeout
- NullPointerException
- Connection Refused
- Authentication Error
- SQL Error
- Unknown

## Root Cause Confidence
請輸出 0~100 的信心分數，例如：
82

## 跨服務錯誤摘要
說明整體發生什麼問題。

## Timeline
每一行格式：
- [service1] 10:01:01 收到請求

## Root Cause
推測最可能根本原因。

## 修復建議
提供具體修法。

## Jira Ticket
### Title
### Description
### Priority

Logs:
${mergedLogs}
`;

        try {
            const response = await client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
            });

            return Response.json({
                result: response.choices[0].message.content || mockResult,
            });
        } catch (error: unknown) {
            console.error("OpenAI analyze error:", error);
            return Response.json({ result: mockResult });
        }
    } catch (error: unknown) {
        console.error("Analyze API error:", error);
        return Response.json({ error: "分析失敗" }, { status: 500 });
    }
}