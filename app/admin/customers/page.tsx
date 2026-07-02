'use client'

import { useEffect, useRef, useState } from 'react'
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
  const [editingInfo, setEditingInfo] = useState<string | null>(null)
  const [nameValue, setNameValue] = useState('')
  const [phoneValue, setPhoneValue] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [searchType, setSearchType] = useState<'이름' | '연락처'>('이름')
  const [searchValue, setSearchValue] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 12
  const menuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!openMenu) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openMenu])

  function startEdit(customer: Customer) {
    setEditingMemo(customer.id)
    setMemoValue(customer.memo ?? '')
    setOpenMenu(null)
  }

  async function saveMemo(id: string) {
    setSavingId(id)
    const supabase = createClient()
    await supabase.from('customers').update({ memo: memoValue }).eq('id', id)
    setCustomers(cs => cs.map(c => c.id === id ? { ...c, memo: memoValue } : c))
    setEditingMemo(null)
    setSavingId(null)
  }

  function startEditInfo(customer: Customer) {
    setEditingInfo(customer.id)
    setNameValue(customer.name)
    setPhoneValue(customer.phone)
    setEditingMemo(null)
    setOpenMenu(null)
  }

  async function saveInfo(customer: Customer) {
    const trimmedName = nameValue.trim()
    const trimmedPhone = phoneValue.replace(/-/g, '').trim()
    if (!trimmedName || !trimmedPhone) return
    setSavingId(customer.id)
    const supabase = createClient()
    const oldPhone = customer.phone
    await supabase.from('customers').update({ name: trimmedName, phone: trimmedPhone }).eq('id', customer.id)
    await supabase.from('consultations')
      .update({ customer_name: trimmedName, phone: trimmedPhone })
      .eq('phone', oldPhone)
    setCustomers(cs => cs.map(c => c.id === customer.id ? { ...c, name: trimmedName, phone: trimmedPhone } : c))
    setEditingInfo(null)
    setSavingId(null)
  }

  const filtered = customers.filter(c => {
    if (!searchValue) return true
    if (searchType === '이름') return c.name.includes(searchValue)
    return c.phone.replace(/-/g, '').includes(searchValue.replace(/-/g, ''))
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold text-gray-900">고객 관리</h1>
      <p className="text-xs text-gray-400">상담 추가 시 고객이 자동으로 등록됩니다. (핸드폰번호 기준 중복 방지)</p>

      <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white w-fit">
        <select
          value={searchType}
          onChange={e => { setSearchType(e.target.value as '이름' | '연락처'); setSearchValue('') }}
          className="px-2 py-1.5 text-sm text-gray-600 bg-gray-50 border-r border-gray-200 outline-none"
        >
          <option>이름</option>
          <option>연락처</option>
        </select>
        <input
          type="text"
          value={searchValue}
          onChange={e => { setSearchValue(e.target.value); setPage(0) }}
          placeholder="검색"
          className="px-3 py-1.5 text-sm text-gray-900 outline-none w-44 bg-white placeholder:text-gray-400"
        />
      </div>

      {customers.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-400">등록된 고객이 없습니다.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-400">검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => {
            const customer = paged[i]
            if (!customer) return (
              <div key={`empty-${i}`} className="bg-white border border-gray-100 rounded-lg p-4 h-[140px]" />
            )
            return (
            <div key={customer.id} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col justify-between min-h-[140px]">
              <div>
                {/* 이름/번호 행 + ... 버튼 */}
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    {editingInfo === customer.id ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-400 w-8 shrink-0">이름</label>
                          <input
                            type="text"
                            value={nameValue}
                            onChange={e => setNameValue(e.target.value)}
                            autoFocus
                            className="border border-gray-300 rounded px-2 py-0.5 text-sm text-gray-900 outline-none focus:border-gray-500 flex-1 min-w-0"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-400 w-8 shrink-0">번호</label>
                          <input
                            type="text"
                            value={phoneValue}
                            onChange={e => setPhoneValue(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-0.5 text-sm text-gray-900 outline-none focus:border-gray-500 flex-1 min-w-0"
                          />
                        </div>
                        <div className="flex gap-2 mt-0.5">
                          <button
                            onClick={() => void saveInfo(customer)}
                            disabled={savingId === customer.id || !nameValue.trim() || !phoneValue.trim()}
                            className="px-2 py-0.5 bg-gray-900 text-white text-xs rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingInfo(null)}
                            className="px-2 py-0.5 border border-gray-200 text-gray-500 text-xs rounded hover:bg-gray-50 transition-colors"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-sm text-gray-900">{customer.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{customer.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')}</p>
                        <p className="text-xs text-gray-400 mt-0.5">등록일 {new Date(customer.created_at).toLocaleDateString('ko-KR')}</p>
                      </>
                    )}
                  </div>

                  {/* ... 드롭다운 */}
                  {editingInfo !== customer.id && editingMemo !== customer.id && (
                    <div className="relative shrink-0" ref={openMenu === customer.id ? menuRef : undefined}>
                      <button
                        onClick={() => setOpenMenu(o => o === customer.id ? null : customer.id)}
                        className="text-gray-600 hover:text-gray-900 text-sm font-bold leading-none px-2 py-1 rounded-md border border-gray-200 hover:border-gray-400 hover:bg-gray-100 transition-colors"
                      >
                        ···
                      </button>
                      {openMenu === customer.id && (
                        <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-lg shadow-md py-1 w-24">
                          <button
                            onClick={() => startEditInfo(customer)}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            정보 수정
                          </button>
                          <button
                            onClick={() => startEdit(customer)}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            메모 편집
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 메모 편집 */}
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
                        className="px-2 py-1 bg-gray-900 text-white text-xs rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingMemo(null)}
                        className="px-2 py-1 border border-gray-200 text-gray-500 text-xs rounded hover:bg-gray-50 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  editingInfo !== customer.id && (
                    <div className="mt-2">
                      {customer.memo ? (
                        <p className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-2">{customer.memo}</p>
                      ) : (
                        <p className="text-xs text-gray-300">메모 없음</p>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
            )
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 text-sm text-gray-900 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-30 transition-colors"
          >
            이전
          </button>
          <span className="text-sm text-gray-900">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 text-sm text-gray-900 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-30 transition-colors"
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}
