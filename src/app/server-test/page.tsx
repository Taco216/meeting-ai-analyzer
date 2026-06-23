import { createClient } from '@/utils/supabase/server'

export default async function ServerTestPage() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('todos')
        .select('*')

    if (error) {
        return (
            <div>
                <h1>❌ Server 測試失敗</h1>
                <p>{error.message}</p>
            </div>
        )
    }

    return (
        <div>
            <h1>✅ Server 測試成功</h1>
            <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
    )
}