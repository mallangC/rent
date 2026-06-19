'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Customer = {
  id: string
  created_at: string
  name: string
  phone: string
  memo: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [editingMemo, setEditingMemo] = useState<string | null>(null)
  const [memoValue, setMemoValue] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  async function fetchCustomers() {
    const supabase = createClient()
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    setCustomers(data ?? [])
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCustomers()
  }, [])

  function startEdit(customer: Customer) {
    setEditingMemo(customer.id)
    setMemoValue(customer.memo ?? '')
  }

  async function saveMemo(id: string) {
    setSavingId(id)
    const supabase = createClient()
    await supabase.from('customers').update({ memo: memoValue }).eq('id', id)
    setCustomers(cs => cs.map(c => c.id === id ? { ...c, memo: memoValue } : c))
    setEditingMemo(null)
    setSavingId(null)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold text-gray-900">고객 관리</h1>
      <p className="text-xs text-gray-400">상담 추가 시 고객이 자동으로 등록됩니다. (핸드폰번호 기준 중복 방지)</p>

      {customers.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-400">등록된 고객이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map(customer => (
            <div key={customer.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">{customer.name}</span>
                    <span className="text-sm text-gray-500">{customer.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    등록일 {new Date(customer.created_at).toLocaleDateString('ko-KR')}
                  </p>

                  {editingMemo === customer.id ? (
                    <div className="mt-2 flex gap-2">
                      <textarea
                        value={memoValue}
                        onChange={e => setMemoValue(e.target.value)}
                        rows={2}
                        className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-500 resize-none"
                        placeholder="메모를 입력하세요"
                      />
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => saveMemo(customer.id)}
                          disabled={savingId === customer.id}
                          className="px-3 py-1 bg-gray-900 text-white text-xs rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setEditingMemo(null)}
                          className="px-3 py-1 border border-gray-200 text-gray-500 text-xs rounded hover:bg-gray-50 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      {customer.memo ? (
                        <p className="text-xs text-gray-600 whitespace-pre-wrap">{customer.memo}</p>
                      ) : (
                        <p className="text-xs text-gray-300">메모 없음</p>
                      )}
                    </div>
                  )}
                </div>

                {editingMemo !== customer.id && (
                  <button
                    onClick={() => startEdit(customer)}
                    className="shrink-0 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    메모 편집
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
