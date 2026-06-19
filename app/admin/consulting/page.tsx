'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STATUSES = ['기본', '불량', '부재', '관리', '가망', '계약', '출고'] as const

const STATUS_STYLE: Record<string, string> = {
  기본: 'bg-gray-100 text-gray-600',
  불량: 'bg-red-100 text-red-600',
  부재: 'bg-orange-100 text-orange-600',
  관리: 'bg-blue-100 text-blue-600',
  가망: 'bg-purple-100 text-purple-600',
  계약: 'bg-green-100 text-green-600',
  출고: 'bg-emerald-100 text-emerald-700',
}
const PAGE_SIZE = 10

type Consultation = {
  id: string
  date: string
  status: string
  customer_name: string
  phone: string
  manager: string
  content: string
  recall_date: string | null
  created_at: string
}

type FormData = Omit<Consultation, 'id' | 'created_at'>

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length < 4) return digits
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function stripPhone(value: string): string {
  return value.replace(/-/g, '')
}

const empty: FormData = {
  date: new Date().toISOString().slice(0, 10),
  status: '기본',
  customer_name: '',
  phone: '',
  manager: '',
  content: '',
  recall_date: null,
}

export default function ConsultingPage() {
  return (
    <Suspense>
      <ConsultingContent />
    </Suspense>
  )
}

function ConsultingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [list, setList] = useState<Consultation[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>(empty)
  const [phoneDisplay, setPhoneDisplay] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [filterStatus, setFilterStatus] = useState<string>(() => searchParams.get('status') ?? '')
  const [searchPhone, setSearchPhone] = useState('')
  const [searchName, setSearchName] = useState('')
  const [searchType, setSearchType] = useState<'name' | 'phone'>('name')

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStatusDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function openStatusDropdown(e: React.MouseEvent<HTMLButtonElement>, id: string) {
    const rect = e.currentTarget.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX })
    setStatusDropdown(id)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  async function fetchList(p: number, status: string, phone: string, name: string) {
    const supabase = createClient()
    const from = p * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('consultations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (phone) query = query.ilike('phone', `%${stripPhone(phone)}%`)
    if (name) query = query.ilike('customer_name', `%${name}%`)

    const { data, count } = await query.range(from, to)
    setList(data ?? [])
    setTotal(count ?? 0)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchList(page, filterStatus, searchPhone, searchName)
  }, [page, filterStatus, searchPhone, searchName])

  function openAdd() {
    setEditingId(null)
    setForm(empty)
    setPhoneDisplay('')
    setError('')
    setShowForm(true)
  }

  function openEdit(item: Consultation) {
    setEditingId(item.id)
    setForm({
      date: item.date,
      status: item.status,
      customer_name: item.customer_name,
      phone: item.phone,
      manager: item.manager,
      content: item.content,
      recall_date: item.recall_date,
    })
    setPhoneDisplay(formatPhone(item.phone))
    setError('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(empty)
    setPhoneDisplay('')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    if (editingId) {
      const { error: updateError } = await supabase
        .from('consultations')
        .update(form)
        .eq('id', editingId)
      if (updateError) {
        setError('수정에 실패했습니다.')
        setLoading(false)
        return
      }
    } else {
      const { error: insertError } = await supabase.from('consultations').insert(form)
      if (insertError) {
        setError('저장에 실패했습니다.')
        setLoading(false)
        return
      }
      await supabase
        .from('customers')
        .upsert({ name: form.customer_name, phone: form.phone }, { onConflict: 'phone', ignoreDuplicates: true })
    }

    closeForm()
    setPage(0)
    await fetchList(0, filterStatus, searchPhone, searchName)
    setLoading(false)
  }

  async function handleStatusChange(id: string, newStatus: string) {
    setStatusDropdown(null)
    const supabase = createClient()
    await supabase.from('consultations').update({ status: newStatus }).eq('id', id)
    setList(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item))
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    const supabase = createClient()
    await supabase.from('consultations').delete().eq('id', id)
    await fetchList(page, filterStatus, searchPhone, searchName)
  }

  const rows = [...list]
  while (rows.length < PAGE_SIZE) {
    rows.push(null as unknown as Consultation)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">상담 관리</h1>
        <button
          onClick={openAdd}
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
        >
          + 상담 추가
        </button>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
          <select
            value={searchType}
            onChange={e => {
              const t = e.target.value as 'name' | 'phone'
              setSearchType(t)
              setSearchName('')
              setSearchPhone('')
              setPage(0)
            }}
            className="px-2 py-1.5 text-sm text-gray-600 bg-gray-50 border-r border-gray-200 outline-none"
          >
            <option value="name">이름</option>
            <option value="phone">연락처</option>
          </select>
          <input
            type="text"
            value={searchType === 'name' ? searchName : searchPhone}
            onChange={e => {
              const v = e.target.value
              if (searchType === 'name') { setSearchName(v); setSearchPhone('') }
              else { setSearchPhone(v); setSearchName('') }
              setPage(0)
            }}
            placeholder="검색"
            className="px-3 py-1.5 text-sm text-gray-900 outline-none w-36 bg-white"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setFilterStatus(''); setPage(0); router.replace('/admin/consulting') }}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${filterStatus === '' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            전체
          </button>
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { setFilterStatus(s); setPage(0); router.replace(`/admin/consulting?status=${s}`) }}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${filterStatus === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" />
          <form onSubmit={handleSubmit} className="relative z-10 bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{editingId ? '상담 수정' : '상담 추가'}</p>
              <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-700 transition-colors text-2xl leading-none">×</button>
            </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">날짜</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">상태</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-500 bg-white"
              >
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">담당자</label>
              <input
                value={form.manager}
                onChange={e => setForm(f => ({ ...f, manager: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-500"
                placeholder="담당자명"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">재상담 날짜</label>
              <input
                type="date"
                value={form.recall_date ?? ''}
                onChange={e => setForm(f => ({ ...f, recall_date: e.target.value || null }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">고객이름</label>
              <input
                value={form.customer_name}
                onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-500"
                placeholder="이름"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">핸드폰번호</label>
              <input
                value={phoneDisplay}
                onChange={e => {
                  const formatted = formatPhone(e.target.value)
                  setPhoneDisplay(formatted)
                  setForm(f => ({ ...f, phone: stripPhone(formatted) }))
                }}
                required
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-500"
                placeholder="010-0000-0000"
              />
            </div>
          </div>
          <div>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={10}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-500 resize-none"
              placeholder="상담 내용을 입력하세요"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '저장 중...' : editingId ? '수정 완료' : '저장'}
            </button>
          </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-400">
              <th className="px-3 py-2 text-center font-normal whitespace-nowrap">날짜</th>
              <th className="px-3 py-2 text-center font-normal whitespace-nowrap">상태</th>
              <th className="px-3 py-2 text-center font-normal whitespace-nowrap">고객명</th>
              <th className="px-3 py-2 text-center font-normal whitespace-nowrap">연락처</th>
              <th className="px-3 py-2 text-center font-normal whitespace-nowrap">담당자</th>
              <th className="px-3 py-2 text-center font-normal">상담 내용</th>
              <th className="px-3 py-2 text-center font-normal whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, i) =>
              item ? (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 text-gray-500 whitespace-nowrap text-center">{item.date}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-center">
                    <button
                      onClick={e => openStatusDropdown(e, item.id)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80 ${STATUS_STYLE[item.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {item.status}
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </td>
                  <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap text-center">{item.customer_name}</td>
                  <td className="px-3 py-3 text-gray-500 whitespace-nowrap text-center">{formatPhone(item.phone)}</td>
                  <td className="px-3 py-3 text-gray-500 whitespace-nowrap text-center">{item.manager}</td>
                  <td className="px-3 py-3 text-gray-500 max-w-0 text-center">
                    <p className="truncate">{item.content || '-'}</p>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(item)} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">수정</button>
                      <span className="text-gray-200">|</span>
                      <button onClick={() => handleDelete(item.id)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">삭제</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={`empty-${i}`} className="border-b border-gray-100">
                  <td colSpan={7} className="h-[45px]" />
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-30 transition-colors"
        >
          이전
        </button>
        <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
        <button
          onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-30 transition-colors"
        >
          다음
        </button>
      </div>

      {statusDropdown && (
        <div
          ref={dropdownRef}
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-0.5 w-[70px]"
        >
          {STATUSES.map(s => {
            const current = list.find(i => i.id === statusDropdown)?.status
            return (
              <button
                key={s}
                onClick={() => handleStatusChange(statusDropdown, s)}
                className={`block w-full text-center px-2 py-1 text-xs hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${current === s ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
              >
                {s}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
