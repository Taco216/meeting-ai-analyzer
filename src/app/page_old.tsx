"use client";

import { useState } from "react";
import jsPDF from "jspdf";

export default function Home() {
    const [service1Log, setService1Log] = useState("");
    const [service2Log, setService2Log] = useState("");
    const [result, setResult] = useState("");
    const [loading, setLoading] = useState(false);

    const [question, setQuestion] = useState("");
    const [chatMessages, setChatMessages] = useState<
        { role: "user" | "assistant"; content: string }[]
    >([]);
    const [chatLoading, setChatLoading] = useState(false);

    // 🔹 API 呼叫
    const analyzeLog = async () => {
        setLoading(true);
        setResult("");

        try {
            const res = await fetch("/api/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    logs: [
                        { serviceName: "service1", content: service1Log },
                        { serviceName: "service2", content: service2Log },
                    ],
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setResult(data.error || "分析失敗");
                return;
            }

            setResult(data.result);
        } catch (err) {
            console.error(err);
            setResult("系統錯誤");
        } finally {
            setLoading(false);
        }
    };

    // 🔹 Timeline 解析
    const parseTimeline = (text: string) => {
        const timelineSection = text.split("## Timeline")[1]?.split("##")[0];
        if (!timelineSection) return [];

        return timelineSection
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith("-"))
            .map((line) => {
                const match = line.match(/-\s*\[(.*?)\]\s*(\S+)?\s*(.*)/);

                return {
                    service: match?.[1] || "unknown",
                    time: match?.[2] || "",
                    message: match?.[3] || line.replace("-", "").trim(),
                    isError:
                        line.toLowerCase().includes("error") ||
                        line.toLowerCase().includes("timeout") ||
                        line.includes("錯誤") ||
                        line.includes("失敗"),
                };
            });
    };

    const timelineItems = parseTimeline(result);

    // 🔹 Jira 複製
    const copyJiraTicket = async () => {
        const jira = result.split("## Jira Ticket")[1];
        if (!jira) return alert("沒有 Jira Ticket");

        await navigator.clipboard.writeText(jira.trim());
        alert("已複製");
    };

    // 🔹 Markdown 下載
    const downloadMarkdown = () => {
        const blob = new Blob([result], {
            type: "text/markdown;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `log-analysis-${Date.now()}.md`;
        a.click();

        URL.revokeObjectURL(url);
    };

    // 🔹 PDF 下載
    const downloadPDF = () => {
        const doc = new jsPDF();
        const text = result.replace(/##/g, "").replace(/###/g, "");
        const lines = doc.splitTextToSize(text, 180);

        doc.text(lines, 10, 10);
        doc.save(`log-analysis-${Date.now()}.pdf`);
    };

    const askChat = async () => {
        if (!question.trim()) return;

        const userQuestion = question;

        setChatMessages((prev) => [
            ...prev,
            { role: "user", content: userQuestion },
        ]);

        setQuestion("");
        setChatLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    question: userQuestion,
                    analysisResult: result,
                    service1Log,
                    service2Log,
                }),
            });

            const data = await res.json();

            setChatMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: data.answer || data.error || "回覆失敗",
                },
            ]);
        } catch (err) {
            console.error(err);

            setChatMessages((prev) => [
                ...prev,
                { role: "assistant", content: "系統錯誤，請稍後再試" },
            ]);
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-6xl rounded-xl bg-white p-6 shadow">
        <h1 className="mb-4 text-3xl font-bold">LogLens AI</h1>

    {/* 🔹 輸入區 */}
    <div className="grid gap-4 md:grid-cols-2">
    <textarea
        className="h-64 w-full rounded border p-3 font-mono text-sm"
    placeholder="service1 log"
    value={service1Log}
    onChange={(e) => setService1Log(e.target.value)}
    />

    <textarea
    className="h-64 w-full rounded border p-3 font-mono text-sm"
    placeholder="service2 log"
    value={service2Log}
    onChange={(e) => setService2Log(e.target.value)}
    />
    </div>

    {/* 🔹 按鈕 */}
    <button
        onClick={analyzeLog}
    disabled={loading || (!service1Log && !service2Log)}
    className="mt-4 rounded bg-black px-6 py-3 text-white"
        >
        {loading ? "分析中..." : "開始分析"}
        </button>

    {/* 🔹 結果 */}
    {result && (
        <div className="mt-8 space-y-6">
            {/* 工具列 */}
            <div className="flex gap-3">
    <button
        onClick={downloadMarkdown}
        className="rounded bg-green-600 px-4 py-2 text-white"
            >
            Markdown
            </button>

            <button
        onClick={downloadPDF}
        className="rounded bg-red-600 px-4 py-2 text-white"
            >
            PDF
            </button>

        {result.includes("## Jira Ticket") && (
            <button
                onClick={copyJiraTicket}
            className="rounded bg-blue-600 px-4 py-2 text-white"
                >
                複製 Jira
        </button>
        )}
        </div>

        {/* 🔥 Timeline 視覺化 */}
        {timelineItems.length > 0 && (
            <div className="rounded bg-white p-5 shadow">
            <h2 className="mb-4 text-xl font-bold">Timeline</h2>

                <div className="space-y-4">
            {timelineItems.map((item, i) => (
                    <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                <div
                    className={`h-4 w-4 rounded-full ${
                    item.isError ? "bg-red-500" : "bg-blue-500"
                }`}
            />
            {i !== timelineItems.length - 1 && (
                <div className="h-full w-0.5 bg-gray-300" />
            )}
            </div>

            <div className="flex-1 rounded bg-gray-50 p-3">
        <div className="mb-1 flex gap-2 text-xs">
        <span className="bg-gray-200 px-2 py-1 font-bold">
            {item.service}
            </span>
            <span className="text-gray-500">{item.time}</span>
            </div>
            <p className="text-sm">{item.message}</p>
            </div>
            </div>
        ))}
            </div>
            </div>
        )}

        <div className="rounded bg-white p-5 shadow">
        <h2 className="mb-4 text-xl font-bold">Chat with Log</h2>

    <div className="mb-4 space-y-3">
        {chatMessages.length === 0 && (
                <p className="text-sm text-gray-500">
                    你可以問：為什麼 timeout？Root Cause 是哪個服務？要怎麼修？
                        </p>
    )}

        {chatMessages.map((msg, i) => (
            <div
                key={i}
            className={`rounded p-3 text-sm ${
                msg.role === "user"
                    ? "bg-blue-50 text-blue-900"
                    : "bg-gray-100 text-gray-800"
            }`}
        >
            <div className="mb-1 font-bold">
                {msg.role === "user" ? "你" : "AI"}
                </div>
                <pre className="whitespace-pre-wrap">{msg.content}</pre>
            </div>
        ))}
        </div>

        <div className="flex gap-2">
    <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
        if (e.key === "Enter") askChat();
    }}
        placeholder="例如：為什麼 service1 也 timeout？"
        className="flex-1 rounded border p-3 text-sm"
        />

        <button
            onClick={askChat}
        disabled={chatLoading || !question.trim()}
        className="rounded bg-black px-4 py-2 text-white disabled:bg-gray-400"
            >
            {chatLoading ? "回答中..." : "送出"}
            </button>
            </div>
            </div>

        {/* 🔹 文字分析卡片 */}
        {result.split("##").map((section, i) => {
            if (!section.trim()) return null;

            const [title, ...content] = section.split("\n");

            return (
                <div key={i} className="rounded bg-gray-50 p-5 shadow">
            <h3 className="mb-2 text-lg font-bold">{title}</h3>
                <pre className="whitespace-pre-wrap text-sm">
                {content.join("\n")}
                </pre>
                </div>
        );
        })}
        </div>
    )}
    </div>
    </main>
);
}