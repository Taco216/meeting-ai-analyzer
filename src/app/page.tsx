"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

type LogHistory = {
  id: string;
  user_id: string;
  service1_log: string;
  service2_log: string;
  result: string;
  created_at: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");

  const [service1Log, setService1Log] = useState("");
  const [service2Log, setService2Log] = useState("");

  const [result, setResult] = useState("");
  const [history, setHistory] = useState<LogHistory[]>([]);

  const [loading, setLoading] = useState(false);

  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const [messages, setMessages] = useState<
      { role: "user" | "assistant"; content: string }[]
  >([]);

  const [suggestions, setSuggestions] = useState<string[]>([]);


  // 🔹 登入
  const signIn = async () => {
    await supabase.auth.signInWithOtp({ email });
    alert("請收信登入");
  };

  // 登出
  const signOut = async () => {
    await supabase.auth.signOut();

    setUser(null);
    setHistory([]);
    setResult("");
    setService1Log("");
    setService2Log("");
    setMessages([]);
  };

  // 初始化 user
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

  // 動態 AI 問題
  const suggestQuestions = async (analysisResult: string) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "suggest",
        result: analysisResult,
      }),
    });

    const data = await res.json();
    setSuggestions(data.suggestions || []);
  };

  // 分析 log
  const analyze = async () => {
    setLoading(true);

    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        logs: [
          {
            serviceName: "service1",
            content: service1Log,
          },
          {
            serviceName: "service2",
            content: service2Log,
          },
        ],
      }),
    });

    const data = await res.json();
    setResult(data.result || "");

    // 存 DB
    if (user && data.result) {
      await supabase.from("logs").insert({
        user_id: user.id,
        service1_log: service1Log,
        service2_log: service2Log,
        result: data.result,
      });

      await loadHistory();
    }

    setLoading(false);
  };

  // 分享
  const generateShareLink = async (logId: string) => {
    const shareId = crypto.randomUUID().slice(0, 8);

    const { data, error } = await supabase
        .from("logs")
        .update({
          is_public: true,
          share_id: shareId,
        })
        .eq("id", logId)
        .select();

    if (error || !data || data.length === 0) {
      alert("分享失敗");
      return;
    }

    const url = `${window.location.origin}/share/${shareId}`;

    await navigator.clipboard.writeText(url);
    alert("分享連結已複製");
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

  // Chat
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
        headers: {
          "Content-Type": "application/json",
        },
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
          content: data.answer || "回覆失敗",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Timeline 點擊分析
  const askTimelineItem = async (item: {
    service: string;
    time: string;
    message: string;
    isError: boolean;
  }) => {
    const q = `
請解釋這個 Timeline 事件：

服務：${item.service}
時間：${item.time}
事件：${item.message}

請回答：
1. 這一步在系統流程中代表什麼？
2. 這一步是否可能是 Root Cause？
3. 如果是錯誤，該怎麼修？
`;

    await askChat(q);
  };

  // Timeline parser
  const parseTimeline = (text: string) => {
    const section = text.split("## Timeline")[1]?.split("##")[0];

    if (!section) return [];

    return section
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("-"))
        .map((line) => {
          const match = line.match(/-\s*\[(.*?)\]\s*(\S+)?\s*(.*)/);

          return {
            service: match?.[1] || "unknown",
            time: match?.[2] || "",
            message: match?.[3] || line,
            isError:
                line.toLowerCase().includes("error") ||
                line.toLowerCase().includes("timeout") ||
                line.includes("失敗"),
          };
        });
  };

  const timelineItems = parseTimeline(result);

  return (
      <main className="p-6 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">LogLens AI</h1>

        {/* 登入 */}
        {!user && (
            <div className="mb-6 flex gap-2">
              <input
                  placeholder="輸入 Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border p-2 flex-1"
              />

              <button
                  onClick={signIn}
                  className="bg-black text-white px-4"
              >
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
          {loading ? "分析中..." : "開始分析"}
        </button>

        {/* 結果 */}
        {result && (
            <>
              <div className="mt-6 rounded bg-white p-5 shadow">
                <h2 className="mb-3 text-xl font-bold">Timeline</h2>

                <p className="mb-4 text-sm text-gray-500">
                  點擊 Timeline 事件可讓 AI 解釋。
                </p>

                <div className="space-y-4">
                  {timelineItems.map((item, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div
                              className={`h-4 w-4 rounded-full ${
                                  item.isError
                                      ? "bg-red-500"
                                      : "bg-blue-500"
                              }`}
                          />

                          {i !== timelineItems.length - 1 && (
                              <div className="h-full w-0.5 bg-gray-300" />
                          )}
                        </div>

                        <div
                            onClick={() => askTimelineItem(item)}
                            className="flex-1 cursor-pointer rounded bg-gray-50 p-3 hover:bg-gray-100"
                        >
                          <div className="mb-1 flex gap-2 text-xs">
                        <span className="bg-gray-200 px-2 py-1 font-bold rounded">
                          {item.service}
                        </span>

                            <span className="text-gray-500">
                          {item.time}
                        </span>
                          </div>

                          <p className="text-sm">{item.message}</p>
                        </div>
                      </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded bg-white p-5 shadow">
                <h2 className="mb-4 text-xl font-bold">與 Log 聊天</h2>

                {suggestions.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {suggestions.map((q, i) => (
                          <button
                              key={i}
                              onClick={() => askChat(q)}
                              className="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                          >
                            {q}
                          </button>
                      ))}
                    </div>
                )}

                <div className="mb-4 space-y-3 max-h-96 overflow-y-auto">
                  {messages.map((msg, i) => (
                      <div
                          key={i}
                          className={`rounded p-3 text-sm ${
                              msg.role === "user"
                                  ? "bg-blue-50 text-blue-900"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                      >
                        <div className="mb-1 font-bold">
                          {msg.role === "user" ? "你" : "人工智慧"}
                        </div>

                        <pre className="whitespace-pre-wrap">
                      {msg.content}
                    </pre>
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
                </div>
              </div>
              <div className="mt-6 rounded bg-white p-5 shadow">
                <h2 className="mb-4 text-xl font-bold">分析結果</h2>

                <pre className="whitespace-pre-wrap text-sm">
                {result}
              </pre>
              </div>
            </>
        )}

        {user && history.length > 0 && (
            <div className="mt-6 rounded bg-white p-5 shadow">
              <h2 className="font-bold mb-3">歷史紀錄</h2>

              {history.map((h) => (
                  <div
                      key={h.id}
                      className="border p-3 mb-2 flex justify-between items-center rounded"
                  >
                    <div
                        onClick={() => setResult(h.result || "")}
                        className="cursor-pointer"
                    >
                      <div className="text-sm text-gray-500">
                        {new Date(h.created_at).toLocaleString()}
                      </div>

                      <div className="text-sm truncate">
                        {(h.result || "無分析結果").slice(0, 60)}
                      </div>
                    </div>

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