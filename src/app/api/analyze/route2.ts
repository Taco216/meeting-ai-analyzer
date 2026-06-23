import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

type LogInput = {
    serviceName: string;
    content: string;
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const logs: LogInput[] = body.logs || [];


        // 🔹 過濾空 log
        const validLogs = logs.filter(
            (item) => item.content && item.content.trim()
        );

        if (validLogs.length === 0) {
            return Response.json(
                { error: "請至少輸入一份 log" },
                { status: 400 }
            );
        }

        // 🔹 合併 log（避免太長）
        const mergedLogs = validLogs
            .map(
                (item) => `
===== ${item.serviceName} LOG START =====
${item.content.slice(0, 8000)}
===== ${item.serviceName} LOG END =====
`
            )
            .join("\n");

        // 🔥 Prompt（核心）
        const prompt = `
你是一位資深分散式系統工程師，擅長分析 Java / Spring Boot / API / SQL log。

以下是多個服務的 log，請做跨服務分析。

請嚴格用 Markdown 格式輸出：

## 跨服務錯誤摘要
說明整體發生什麼問題。

## 最可能先出錯的服務
指出 service1 / service2 哪個最可能是根因，並說明原因。

## 呼叫流程推測
整理 service1 到 service2 的可能呼叫流程。

## Timeline
請用以下格式輸出，每一行一個事件：
- [service1] 10:01:01 收到 POST /api/orders 請求
- [service1] 10:01:02 呼叫 service2 payment API
- [service2] 10:01:03 查詢 transaction table
- [service2] 10:01:07 發生 SQL timeout
- [service1] 10:01:08 收到 service2 timeout 錯誤

## Root Cause
推測最可能的根本原因。

## 關鍵 Log
分服務列出重要錯誤行。

## 影響範圍
說明可能影響的 API / DB / 使用者。

## 修復建議
提供具體修法（可附 code）。

## Jira Ticket
### Title
英文標題

### Description
描述問題

### Steps to Reproduce
1. ...
2. ...
3. ...

### Expected Result
預期結果

### Actual Result
實際結果

### Priority
Low / Medium / High

Logs:
${mergedLogs}
`;

        // 🔹 呼叫 OpenAI
        // const response = await client.chat.completions.create({
        //     model: "gpt-4o-mini",
        //     messages: [
        //         {
        //             role: "user",
        //             content: prompt,
        //         },
        //     ],
        // });

        // return Response.json({
        //     result: response.choices[0].message.content,
        // });

        return Response.json({
            result: `
## 跨服務錯誤摘要
使用者建立訂單時，service1 呼叫 service2（payment-service）發生 timeout，導致訂單建立失敗。

## 最可能先出錯的服務
service2（payment-service）

原因：
service2 在查詢資料庫時發生 SQL timeout，導致無法回應 service1。

## 呼叫流程推測
1. service1 收到訂單請求
2. service1 呼叫 service2 payment API
3. service2 查詢 transaction table
4. service2 DB 發生 timeout
5. service1 等待回應超時

## Timeline
- [service1] 10:01:01 收到 POST /api/orders 請求
- [service1] 10:01:02 呼叫 service2 payment API
- [service2] 10:01:03 查詢 transaction table
- [service2] 10:01:07 發生 SQL timeout
- [service1] 10:01:08 收到 service2 timeout 錯誤

## Root Cause
payment-service 查詢資料庫時 SQL 執行時間過長，導致 timeout。

## 關鍵 Log
service1:
java.net.SocketTimeoutException: Read timed out

service2:
com.microsoft.sqlserver.jdbc.SQLServerException: Query timeout expired

## 影響範圍
- 訂單建立 API（/api/orders）
- 付款流程
- 約 100% 使用者在該時間段無法完成交易

## 修復建議
1. 檢查 transaction table 是否缺少 index
2. 優化 SQL 查詢條件
3. 增加 DB connection pool
4. service1 增加 retry 機制

範例：

Java retry：
\`\`\`java
for (int i = 0; i < 3; i++) {
    try {
        callPaymentService();
        break;
    } catch (Exception e) {
        Thread.sleep(1000);
    }
}
\`\`\`

## Jira Ticket
### Title
Fix payment-service SQL timeout causing order failure

### Description
Order creation fails when payment-service cannot respond due to a database query timeout.

### Steps to Reproduce
1. Call POST /api/orders
2. Ensure DB query in payment-service is slow
3. Observe timeout error

### Expected Result
Order should be created successfully with valid payment response.

### Actual Result
Order API fails due to timeout from payment-service.

### Priority
High
`,
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

        return Response.json(
            { error: error.message || "分析失敗" },
            { status: 500 }
        );
    }
}