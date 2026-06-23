'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Todo = {
    id: number
    title: string
    is_done: boolean
    created_at: string
}

export default function TodoClient() {
    const supabase = createClient()

    const [todos, setTodos] = useState<Todo[]>([])
    const [title, setTitle] = useState('')
    const [loading, setLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    async function fetchTodos() {
        setLoading(true)
        setErrorMessage('')

        const { data, error } = await supabase
            .from('todos')
            .select('*')
            .order('id', { ascending: true })

        if (error) {
            setErrorMessage(error.message)
        } else {
            setTodos(data ?? [])
        }

        setLoading(false)
    }

    async function addTodo() {
        if (!title.trim()) return

        const { error } = await supabase
            .from('todos')
            .insert({
                title,
                is_done: false,
            })

        if (error) {
            setErrorMessage(error.message)
            return
        }

        setTitle('')
        fetchTodos()
    }

    async function toggleTodo(todo: Todo) {
        const { error } = await supabase
            .from('todos')
            .update({
                is_done: !todo.is_done,
            })
            .eq('id', todo.id)

        if (error) {
            setErrorMessage(error.message)
            return
        }

        fetchTodos()
    }

    async function deleteTodo(id: number) {
        const { error } = await supabase
            .from('todos')
            .delete()
            .eq('id', id)

        if (error) {
            setErrorMessage(error.message)
            return
        }

        fetchTodos()
    }

    useEffect(() => {
        fetchTodos()
    }, [])

    return (
        <main style={{ padding: 24 }}>
            <h1>Supabase CRUD 測試</h1>

            <div style={{ marginBottom: 16 }}>
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="輸入 todo"
                    style={{ padding: 8, marginRight: 8 }}
                />

                <button onClick={addTodo}>
                    新增
                </button>
            </div>

            {loading && <p>Loading...</p>}

            {errorMessage && (
                <p style={{ color: 'red' }}>
                    錯誤：{errorMessage}
                </p>
            )}

            <ul>
                {todos.map((todo) => (
                    <li key={todo.id} style={{ marginBottom: 8 }}>
            <span
                style={{
                    textDecoration: todo.is_done ? 'line-through' : 'none',
                    marginRight: 8,
                }}
            >
              {todo.title}
            </span>

                        <button onClick={() => toggleTodo(todo)}>
                            {todo.is_done ? '改成未完成' : '完成'}
                        </button>

                        <button
                            onClick={() => deleteTodo(todo.id)}
                            style={{ marginLeft: 8 }}
                        >
                            刪除
                        </button>
                    </li>
                ))}
            </ul>
        </main>
    )
}