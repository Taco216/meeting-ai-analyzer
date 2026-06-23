"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");

  const [service1Log, setService1Log] = useState("");
  const [service2Log, setService2Log] = useState("");

  const [result, setResult] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [question, setQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<
      { role: "user" | "assistant"; content: string }[]
  >([]);
  const [chatLoading, setChatLoading] = useState(false);

  const [messages, setMessages] = useState<
      { role: "user" | "assistant"; content: string }[]
  >([]);

  // 🔹 登入
  const signIn = async () => {
    await supabase.auth.signInWithOtp({ email });
    alert("請收信登入");
  };

  // 🔹 初始化 user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user || null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  // 🔹 讀歷史
  const loadHistory = async () => {
    if (!user) return;

    const { data } = await supabase
        .from("logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

    setHistory(data || []);
  };

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  // 🔹 分析
  const analyze = async () => {
    setLoading(true);
    setResult("");

    const res = await fetch("/api/analyze", {
      method: "POST",
      body: JSON.stringify({
        logs: [
          { serviceName: "service1", content: service1Log },
          { serviceName: "service2", content: service2Log },
        ],
      }),
    });

    const data = await res.json();
    setResult(data.result);

    // 👉 存 DB
    if (user) {
      console.log("user:", user);

      const { data: insertData, error } = await supabase
          .from("logs")
          .insert({
            user_id: user.id,
            service1_log: service1Log,
            service2_log: service2Log,
            result: data.result,
          })
          .select();

      console.log("insert data:", insertData);
      console.log("insert error:", error);

      await loadHistory();
    }

    setLoading(false);
  };

  const generateShareLink = async (logId: string) => {
    console.log("logId:", logId);

    const shareId = crypto.randomUUID().slice(0, 8);

    const { data, error } = await supabase
        .from("logs")
        .update({
          is_public: true,
          share_id: shareId,
        })
        .eq("id", logId)
        .select("id, share_id, is_public");

    console.log("update data:", data);
    console.log("update error:", error);

    if (error) {
      alert("分享失敗：" + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert("沒有更新到資料，可能是 RLS 擋住 update");
      return;
    }

    const url = `${window.location.origin}/share/${shareId}`;
    await navigator.clipboard.writeText(url);
    alert("分享連結已複製：" + url);
  };

  const signOut = async () => {
    await supabase.auth.signOut();

    setUser(null);
    setHistory([]);
    setResult("");
    setService1Log("");
    setService2Log("");
  };

  // const askChat = async () => {
  //   if (!question.trim()) return;
  //
  //   const userQuestion = question;
  //
  //   setChatMessages((prev) => [
  //     ...prev,
  //     { role: "user", content: userQuestion },
  //   ]);
  //
  //   setQuestion("");
  //   setChatLoading(true);
  //
  //   try {
  //     const res = await fetch("/api/chat", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({
  //         question: userQuestion,
  //         result,
  //         service1Log,
  //         service2Log,
  //       }),
  //     });
  //
  //     const data = await res.json();
  //
  //     setChatMessages((prev) => [
  //       ...prev,
  //       {
  //         role: "assistant",
  //         content: data.answer || data.error || "回覆失敗",
  //       },
  //     ]);
  //   } catch (err) {
  //     setChatMessages((prev) => [
  //       ...prev,
  //       { role: "assistant", content: "系統錯誤" },
  //     ]);
  //   } finally {
  //     setChatLoading(false);
  //   }
  // };

  const askChat = async (preset?: string) => {
    const questionText = typeof preset === "string" ? preset : question;
    if (!questionText.trim()) return;

    const newMessages = [
      ...messages,
      { role: "user" as const, content: questionText },
    ];

    setMessages(newMessages);
    setQuestion("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          result,
          service1Log,
          service2Log,
        }),
      });

      const data = await res.json();

      setMessages([
        ...newMessages,
        {
          role: "assistant" as const,
          content: data.answer || data.error || "回覆失敗",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const askTimelineItem = async (item: {
    service: string;
    time: string;
    message: string;
    isError: boolean;
  }) => {
    const question = `
    請解釋這個 Timeline 事件：
    
    服務：${item.service}
    時間：${item.time}
    事件：${item.message}
    
    請回答：
    1. 這一步在系統流程中代表什麼？
    2. 這一步是否可能是 Root Cause？
    3. 如果是錯誤，該怎麼修？
    `;

    await askChat(question);
  };

  return (
      <main className="p-6 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">LogLens AI</h1>

        {/* 登入 */}
        {!user && (
            <div className="flex gap-2 mb-4">
              <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="border p-2"
              />
              <button onClick={signIn} className="bg-black text-white px-4">
                登入
              </button>
            </div>
        )}

        {user && (
            <div className="mb-4 flex items-center justify-between">
              <div>👤 {user.email}</div>

              <button
                  onClick={signOut}
                  className="rounded bg-gray-700 px-4 py-2 text-white"
              >
                登出
              </button>
            </div>
        )}

        {/* log 輸入 */}
        <textarea
            className="w-full h-40 border p-2 mb-2"
            placeholder="service1 log"
            value={service1Log}
            onChange={(e) => setService1Log(e.target.value)}
        />

        <textarea
            className="w-full h-40 border p-2 mb-2"
            placeholder="service2 log"
            value={service2Log}
            onChange={(e) => setService2Log(e.target.value)}
        />

        <button
            onClick={analyze}
            className="bg-black text-white px-4 py-2"
        >
          {loading ? "分析中..." : "分析"}
        </button>

        {/* 結果 */}
        {result && (
            <pre className="bg-gray-100 p-4 mt-4 whitespace-pre-wrap">
          {result}
        </pre>
        )}

        {/* Chat UI */}
        <div className="mt-6 rounded bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-bold">與 Log 聊天</h2>


          {/* 提示文字*/}
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              "為什麼會 timeout？",
              "真正 Root Cause 是哪個服務？",
              "怎麼修這個問題？",
              "會影響哪些系統？",
            ].map((q) => (
                <button
                    key={q}
                    onClick={() => askChat(q)}
                    className="text-sm px-3 py-1 bg-gray-200 rounded"
                >
                  {q}
                </button>
            ))}
          </div>

          <div className="mb-4 space-y-3">
            {messages.map((msg, i) => (
                <div
                    key={i}
                    className={`rounded p-3 text-sm ${
                        msg.role === "user"
                            ? "bg-blue-50"
                            : "bg-gray-100"
                    }`}
                >
                  <div className="font-bold mb-1">
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
                placeholder="問問題..."
                className="flex-1 rounded border p-3"
            />

            <button
                onClick={() => askChat()}
                disabled={chatLoading || !question.trim()}
                className="rounded bg-black px-4 py-2 text-white"
            >
              {chatLoading ? "回答中..." : "送出"}
            </button>

            <button
                onClick={() => setMessages([])}
                className="text-xs text-gray-500 underline mb-2"
            >
              清空對話
            </button>
          </div>
        </div>


        {/* 歷史 */}
        {user && history.length > 0 && (
            <div className="mt-6">
              <h2 className="font-bold mb-2">歷史紀錄</h2>

              {history.map((h) => (
                  <div
                      key={h.id}
                      className="border p-3 mb-2 flex justify-between items-center"
                  >
                    <div
                        onClick={() => setResult(h.result)}
                        className="cursor-pointer"
                    >
                      <div className="text-sm text-gray-500">
                        {new Date(h.created_at).toLocaleString()}
                      </div>
                      <div className="text-sm truncate">
                        {(h.result || "無分析結果").slice(0, 60)}
                      </div>
                    </div>

                    {/* ✅ 分享按鈕要在這裡 */}
                    <button
                        onClick={() => generateShareLink(h.id)}
                        className="ml-3 text-blue-600 text-sm underline"
                    >
                      分享
                    </button>
                  </div>
              ))}
            </div>
        )}

      </main>
  );
}