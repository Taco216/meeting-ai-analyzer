import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function SharePage({
                                            params,
                                        }: {
    params: { id: string };
}) {
    // 🔹 查資料
    const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("share_id", params.id)
        .eq("is_public", true)
        .single();

    // 🔹 找不到
    if (!data) {
        return (
            <main className="p-10 text-center">
                <h1 className="text-2xl font-bold mb-2">找不到分享資料</h1>
                <p className="text-gray-500">
                    可能連結錯誤或已被關閉分享
                </p>
            </main>
        );
    }

    // 🔹 Timeline 解析
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
                        line.includes("錯誤") ||
                        line.includes("失敗"),
                };
            });
    };

    const timeline = parseTimeline(data.result);

    return (
        <main className="min-h-screen bg-gray-100 p-6">
            <div className="mx-auto max-w-4xl rounded bg-white p-6 shadow">
                <h1 className="text-2xl font-bold mb-2">🔍 Log 分析結果</h1>

                <div className="text-sm text-gray-500 mb-6">
                    {new Date(data.created_at).toLocaleString()}
                </div>

                {/* 🔥 Timeline */}
                {timeline.length > 0 && (
                    <div className="mb-6">
                        <h2 className="font-bold mb-3">Timeline</h2>

                        <div className="space-y-4">
                            {timeline.map((item, i) => (
                                <div key={i} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className={`h-3 w-3 rounded-full ${
                                                item.isError ? "bg-red-500" : "bg-blue-500"
                                            }`}
                                        />
                                        {i !== timeline.length - 1 && (
                                            <div className="h-full w-0.5 bg-gray-300" />
                                        )}
                                    </div>

                                    <div className="bg-gray-50 p-3 rounded flex-1">
                                        <div className="text-xs text-gray-500 mb-1">
                                            [{item.service}] {item.time}
                                        </div>
                                        <div className="text-sm">{item.message}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 🔹 分析卡片 */}
                {data.result.split("##").map((section: string, i: number) => {
                    if (!section.trim()) return null;

                    const [title, ...content] = section.split("\n");

                    return (
                        <div key={i} className="mb-4 rounded bg-gray-50 p-4">
                            <h3 className="font-bold mb-2">{title}</h3>
                            <pre className="text-sm whitespace-pre-wrap">
                {content.join("\n")}
              </pre>
                        </div>
                    );
                })}
            </div>
        </main>
    );
}