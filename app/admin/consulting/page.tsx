'use client'

import React, { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '../profile-context'

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

type Consultation = {
  id: string
  created_at: string
  updated_at: string | null
  date: string
  status: string
  customer_name: string
  phone: string
  manager: string
  content: string
  recall_date: string | null
}

type CustomerGroup = {
  phone: string
  customer_name: string
  manager: string
  date: string
  consultations: Consultation[]
  latest: Consultation
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length < 4) return digits
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function stripPhone(value: string): string {
  return value.replace(/-/g, '')
}

function localToday(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function groupByPhone(rows: Consultation[]): CustomerGroup[] {
  const map = new Map<string, Consultation[]>()
  for (const c of rows) {
    const arr = map.get(c.phone) ?? []
    arr.push(c)
    map.set(c.phone, arr)
  }
  const groups: CustomerGroup[] = []
  for (const [phone, cons] of map.entries()) {
    cons.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const latest = cons[0]
    const first = cons[cons.length - 1]
    groups.push({ phone, customer_name: latest.customer_name, manager: first.manager, date: first.date, consultations: cons, latest })
  }
  groups.sort((a, b) => {
    const ta = new Date(a.latest.updated_at ?? a.latest.created_at).getTime()
    const tb = new Date(b.latest.updated_at ?? b.latest.created_at).getTime()
    return tb - ta
  })
  return groups
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
  const profile = useProfile()
  const today = localToday()

  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)

  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') ?? '')
  const [filterManager, setFilterManager] = useState('')
  const [searchType, setSearchType] = useState<'이름' | '연락처'>('이름')
  const [searchValue, setSearchValue] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 15

  // 신규 상담 모달
  const [showNewModal, setShowNewModal] = useState(false)
  const emptyNew = { date: today, status: '기본', customer_name: '', phone: '', manager: profile?.name ?? '', recall_date: '', content: '' }
  const [newForm, setNewForm] = useState(emptyNew)
  const [phoneDisplay, setPhoneDisplay] = useState('')

  // 상담 추가 모달 (기존 고객)
  const [showAddModal, setShowAddModal] = useState(false)
  const emptyAdd = { status: '기본', recall_date: '', content: '' }
  const [addForm, setAddForm] = useState(emptyAdd)

  // 수정 모달
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyAdd)

  // ... 옵션 드롭다운
  const [optionsOpen, setOptionsOpen] = useState<string | null>(null)
  const [optionsPos, setOptionsPos] = useState({ top: 0, left: 0 })
  const optionsRef = useRef<HTMLDivElement>(null)

  const [saving, setSaving] = useState(false)

  async function fetchAll() {
    const supabase = createClient()
    const [{ data: consultData }, { data: customerData }] = await Promise.all([
      supabase.from('consultations').select('*').order('created_at', { ascending: false }),
      supabase.from('customers').select('phone, name'),
    ])
    const nameByPhone = new Map((customerData ?? []).map(c => [c.phone, c.name]))
    const rows = (consultData ?? []).map(c => ({
      ...c,
      customer_name: nameByPhone.get(c.phone) ?? c.customer_name,
    }))
    setCustomerGroups(groupByPhone(rows))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setOptionsOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function openOptions(e: React.MouseEvent<HTMLButtonElement>, id: string) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setOptionsPos({ top: rect.bottom + window.scrollY + 4, left: rect.right + window.scrollX - 96 })
    setOptionsOpen(prev => prev === id ? null : id)
  }

  function openEdit(c: Consultation) {
    setEditingId(c.id)
    setEditForm({ status: c.status, recall_date: c.recall_date ?? '', content: c.content })
    setOptionsOpen(null)
    setShowEditModal(true)
  }

  async function saveEdit() {
    if (!editingId) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('consultations').update({
      status: editForm.status,
      recall_date: editForm.recall_date || null,
      content: editForm.content,
    }).eq('id', editingId)
    setSaving(false)
    setShowEditModal(false)
    setEditingId(null)
    await fetchAll()
  }

  async function deleteConsultation(id: string) {
    if (!confirm('이 상담을 삭제하시겠습니까?')) return
    setOptionsOpen(null)
    const supabase = createClient()
    await supabase.from('consultations').delete().eq('id', id)
    await fetchAll()
  }

  const managers = [...new Set(customerGroups.map(g => g.manager).filter(Boolean))]

  const filteredGroups = customerGroups.filter(g => {
    if (filterStatus && g.latest.status !== filterStatus) return false
    if (filterManager && g.manager !== filterManager) return false
    if (searchValue) {
      if (searchType === '이름' && !g.customer_name.includes(searchValue)) return false
      if (searchType === '연락처' && !g.phone.includes(stripPhone(searchValue))) return false
    }
    return true
  })
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE))
  const pagedGroups = filteredGroups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const todayRecalls = customerGroups.filter(g => g.latest.recall_date === today)

  const selectedGroup = selectedPhone ? customerGroups.find(g => g.phone === selectedPhone) ?? null : null

  async function saveNew() {
    if (!newForm.customer_name || !newForm.phone) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id
    const phone = stripPhone(newForm.phone)
    await supabase.from('consultations').insert({
      date: newForm.date || today,
      status: newForm.status,
      customer_name: newForm.customer_name,
      phone,
      manager: newForm.manager,
      recall_date: newForm.recall_date || null,
      content: newForm.content,
      user_id: userId,
    })
    await supabase.from('customers').upsert({ name: newForm.customer_name, phone, user_id: userId }, { onConflict: 'phone,user_id', ignoreDuplicates: true })
    setSaving(false)
    setShowNewModal(false)
    setNewForm(emptyNew)
    setPhoneDisplay('')
    await fetchAll()
  }

  async function saveAdd() {
    if (!selectedGroup) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('consultations').insert({
      date: selectedGroup.date,
      status: addForm.status,
      customer_name: selectedGroup.customer_name,
      phone: selectedGroup.phone,
      manager: selectedGroup.manager,
      recall_date: addForm.recall_date || null,
      content: addForm.content,
      user_id: user?.id,
    })
    setSaving(false)
    setShowAddModal(false)
    setAddForm(emptyAdd)
    await fetchAll()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">

        {/* 재상담 알림 */}
        {todayRecalls.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-start gap-2">
            <span className="text-sm mt-0.5">🔔</span>
            <div className="flex flex-wrap gap-x-1 text-sm text-amber-800">
              {todayRecalls.map((g, i) => (
                <span key={g.phone}>
                  <button
                    onClick={() => {
                      const idx = filteredGroups.findIndex(fg => fg.phone === g.phone)
                      if (idx !== -1) setPage(Math.floor(idx / PAGE_SIZE))
                      setSelectedPhone(g.phone)
                    }}
                    className="font-semibold hover:underline"
                  >
                    {g.customer_name}
                  </button>
                  {i < todayRecalls.length - 1 ? ',' : ''}
                </span>
              ))}
              <span>님 재상담 날짜입니다.</span>
            </div>
          </div>
        )}

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-gray-900">상담 관리</h1>
          <button
            onClick={() => { setNewForm({ ...emptyNew, manager: profile?.name ?? '' }); setPhoneDisplay(''); setShowNewModal(true) }}
            className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            신규 상담
          </button>
        </div>

        {/* 검색 · 필터 */}
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {/* 검색 */}
          <div className="px-4 py-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <select
              value={searchType}
              onChange={e => { setSearchType(e.target.value as '이름' | '연락처'); setSearchValue(''); setPage(0) }}
              className="text-sm text-gray-500 bg-transparent outline-none border-r border-gray-200 pr-2 mr-1"
            >
              <option>이름</option>
              <option>연락처</option>
            </select>
            <input
              type="text"
              value={searchValue}
              onChange={e => { setSearchValue(e.target.value); setPage(0) }}
              placeholder="고객 검색"
              className="flex-1 text-sm text-gray-900 outline-none placeholder:text-gray-400 bg-transparent"
            />
            {searchValue && (
              <button onClick={() => { setSearchValue(''); setPage(0) }} className="text-gray-300 hover:text-gray-500 text-lg leading-none">×</button>
            )}
          </div>

          {/* 상태 필터 */}
          <div className="px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs text-gray-400 w-10 shrink-0">상태</span>
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => { setFilterStatus(''); setPage(0); router.replace('/admin/consulting') }}
                className={`px-2.5 py-1 rounded-full text-xs transition-colors ${filterStatus === '' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                전체
              </button>
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => { setFilterStatus(s); setPage(0); router.replace(`/admin/consulting?status=${s}`) }}
                  className={`px-2.5 py-1 rounded-full text-xs transition-colors ${filterStatus === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 담당자 필터 - 관리자만 */}
          {profile?.role === '관리자' && managers.length > 0 && (
            <div className="px-4 py-2.5 flex items-center gap-2">
              <span className="text-xs text-gray-400 w-10 shrink-0">담당자</span>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => { setFilterManager(''); setPage(0) }}
                  className={`px-2.5 py-1 rounded-full text-xs transition-colors ${filterManager === '' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  전체
                </button>
                {managers.map(m => (
                  <button
                    key={m}
                    onClick={() => { setFilterManager(m); setPage(0) }}
                    className={`px-2.5 py-1 rounded-full text-xs transition-colors ${filterManager === m ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 고객 목록 테이블 */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 w-8"></th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">이름</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">연락처</th>
                {profile?.role === '관리자' && <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">담당자</th>}
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">최근 상태</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">재상담일</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">상담수</th>
                <th className="px-3 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.length === 0 ? (
                <>
                  <tr>
                    <td colSpan={profile?.role === '관리자' ? 8 : 7} className="px-4 py-10 text-center text-sm text-gray-400">
                      상담 내역이 없습니다.
                    </td>
                  </tr>
                  {Array.from({ length: PAGE_SIZE - 1 }).map((_, i) => (
                    <tr key={`empty-${i}`} className="border-b border-gray-100">
                      <td colSpan={profile?.role === '관리자' ? 8 : 7} className="h-[45px]" />
                    </tr>
                  ))}
                </>
              ) : (
                <>
                  {pagedGroups.map(g => {
                  const isOpen = selectedPhone === g.phone
                  return (
                    <React.Fragment key={g.phone}>
                      <tr
                        onClick={() => setSelectedPhone(isOpen ? null : g.phone)}
                        className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${isOpen ? 'bg-gray-50' : ''}`}
                      >
                        <td className="px-3 py-3 text-center">
                          <svg
                            className={`w-3.5 h-3.5 text-gray-400 mx-auto transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </td>
                        <td className="px-3 py-3 text-center text-gray-900 font-medium">{g.customer_name}</td>
                        <td className="px-3 py-3 text-center text-gray-500 whitespace-nowrap">{formatPhone(g.phone)}</td>
                        {profile?.role === '관리자' && <td className="px-3 py-3 text-center text-gray-500">{g.manager}</td>}
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[g.latest.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {g.latest.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-gray-500 whitespace-nowrap text-xs">
                          {g.latest.recall_date ?? '-'}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-500">{g.consultations.length}</td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedPhone(g.phone); setAddForm(emptyAdd); setShowAddModal(true) }}
                            className="px-2.5 py-1 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap"
                          >
                            상담 추가
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${g.phone}-detail`} className="border-b border-gray-100">
                          <td colSpan={profile?.role === '관리자' ? 8 : 7} className="bg-gray-50 px-0 py-0">
                            {/* 상담 타임라인 */}
                            <div className="divide-y divide-gray-200 border-t border-gray-200">
                              {g.consultations.map((c, i) => (
                                <div key={c.id} className="px-8 py-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-400">
                                        {new Date(c.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                                      </span>
                                      {i === 0 && (
                                        <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">최근</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {c.recall_date && (
                                        <span className={`text-xs ${c.recall_date === today ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                                          재상담 {c.recall_date}
                                        </span>
                                      )}
                                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                        {c.status}
                                      </span>
                                      <button
                                        onClick={e => openOptions(e, c.id)}
                                        className="text-gray-400 hover:text-gray-700 px-1 leading-none text-base transition-colors"
                                      >
                                        ···
                                      </button>
                                    </div>
                                  </div>
                                  {c.content ? (
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                                  ) : (
                                    <p className="text-sm text-gray-300 italic">내용 없음</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                  })}
                  {Array.from({ length: PAGE_SIZE - pagedGroups.length }).map((_, i) => (
                    <tr key={`empty-${i}`} className="border-b border-gray-100">
                      <td colSpan={profile?.role === '관리자' ? 8 : 7} className="h-[45px]" />
                    </tr>
                  ))}
                </>
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
      </div>

      {/* 신규 상담 모달 */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative z-10 bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-gray-900">신규 상담</p>
              <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">날짜</label>
                <input type="date" value={newForm.date} onChange={e => setNewForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">상태</label>
                <select value={newForm.status} onChange={e => setNewForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 bg-white">
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">재상담 날짜</label>
                <input type="date" value={newForm.recall_date} onChange={e => setNewForm(f => ({ ...f, recall_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">고객이름</label>
                <input type="text" value={newForm.customer_name} onChange={e => setNewForm(f => ({ ...f, customer_name: e.target.value }))}
                  placeholder="이름"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">핸드폰번호</label>
                <input type="text" value={phoneDisplay}
                  onChange={e => {
                    const formatted = formatPhone(e.target.value)
                    setPhoneDisplay(formatted)
                    setNewForm(f => ({ ...f, phone: stripPhone(formatted) }))
                  }}
                  placeholder="010-0000-0000"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400" />
              </div>
            </div>

            <div>
              <textarea value={newForm.content} onChange={e => setNewForm(f => ({ ...f, content: e.target.value }))}
                rows={10} placeholder="상담 내용"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 resize-none placeholder:text-gray-400" />
            </div>

            <button onClick={saveNew} disabled={saving || !newForm.customer_name || !newForm.phone}
              className="w-full py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* 상담 추가 모달 (기존 고객) */}
      {showAddModal && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative z-10 bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-gray-900">상담 추가</p>
                <p className="text-xs text-gray-400 mt-0.5">{selectedGroup.customer_name} · {formatPhone(selectedGroup.phone)}</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">상태</label>
                <select value={addForm.status} onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 bg-white">
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">재상담 날짜</label>
                <input type="date" value={addForm.recall_date} onChange={e => setAddForm(f => ({ ...f, recall_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400" />
              </div>
            </div>

            <div>
              <textarea value={addForm.content} onChange={e => setAddForm(f => ({ ...f, content: e.target.value }))}
                rows={8} placeholder="상담 내용"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 resize-none placeholder:text-gray-400" />
            </div>

            <button onClick={saveAdd} disabled={saving}
              className="w-full py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative z-10 bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-gray-900">상담 수정</p>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">상태</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 bg-white">
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">재상담 날짜</label>
                <input type="date" value={editForm.recall_date} onChange={e => setEditForm(f => ({ ...f, recall_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400" />
              </div>
            </div>

            <div>
              <textarea value={editForm.content} onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                rows={8} placeholder="상담 내용"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 resize-none placeholder:text-gray-400" />
            </div>

            <button onClick={saveEdit} disabled={saving}
              className="w-full py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* ··· 옵션 드롭다운 */}
      {optionsOpen && (
        <div
          ref={optionsRef}
          style={{ top: optionsPos.top, left: optionsPos.left }}
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-24"
        >
          {(() => {
            const target = customerGroups.flatMap(g => g.consultations).find(c => c.id === optionsOpen)
            if (!target) return null
            return (
              <>
                <button
                  onClick={() => openEdit(target)}
                  className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  수정
                </button>
                <button
                  onClick={() => deleteConsultation(target.id)}
                  className="block w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-gray-50 transition-colors"
                >
                  삭제
                </button>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
