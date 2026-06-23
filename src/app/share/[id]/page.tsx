import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function SharePage({
                                            params,
                                        }: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const { data } = await supabase
        .from("logs")
        .select("*")
        .eq("share_id", id)
        .eq("is_public", true)
        .single();

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

    return (
        <main className="min-h-screen bg-gray-100 p-6">
            <div className="mx-auto max-w-4xl rounded bg-white p-6 shadow">
                <h1 className="text-2xl font-bold mb-2">🔍 Log 分析結果</h1>

                <div className="text-sm text-gray-500 mb-6">
                    {new Date(data.created_at).toLocaleString()}
                </div>

                <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded">
          {data.result}
        </pre>
            </div>
        </main>
    );
}