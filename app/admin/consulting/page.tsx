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
  const today = localToday()

  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)

  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') ?? '')
  const [searchType, setSearchType] = useState<'이름' | '연락처'>('이름')
  const [searchValue, setSearchValue] = useState('')

  // 신규 상담 모달
  const [showNewModal, setShowNewModal] = useState(false)
  const emptyNew = { date: today, status: '기본', customer_name: '', phone: '', manager: '', recall_date: '', content: '' }
  const [newForm, setNewForm] = useState(emptyNew)
  const [phoneDisplay, setPhoneDisplay] = useState('')

  // 상담 추가 모달 (기존 고객)
  const [showAddModal, setShowAddModal] = useState(false)
  const emptyAdd = { status: '기본', recall_date: '', content: '' }
  const [addForm, setAddForm] = useState(emptyAdd)

  const [saving, setSaving] = useState(false)

  async function fetchAll() {
    const supabase = createClient()
    const { data } = await supabase
      .from('consultations')
      .select('*')
      .order('created_at', { ascending: false })
    const rows = data ?? []
    setCustomerGroups(groupByPhone(rows))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredGroups = customerGroups.filter(g => {
    if (filterStatus && g.latest.status !== filterStatus) return false
    if (searchValue) {
      if (searchType === '이름' && !g.customer_name.includes(searchValue)) return false
      if (searchType === '연락처' && !g.phone.includes(stripPhone(searchValue))) return false
    }
    return true
  })

  const todayRecalls = customerGroups.filter(g =>
    g.consultations.some(c => c.recall_date === today)
  )

  const selectedGroup = selectedPhone ? customerGroups.find(g => g.phone === selectedPhone) ?? null : null

  async function saveNew() {
    if (!newForm.customer_name || !newForm.phone) return
    setSaving(true)
    const supabase = createClient()
    const phone = stripPhone(newForm.phone)
    await supabase.from('consultations').insert({
      date: newForm.date || today,
      status: newForm.status,
      customer_name: newForm.customer_name,
      phone,
      manager: newForm.manager,
      recall_date: newForm.recall_date || null,
      content: newForm.content,
    })
    await supabase.from('customers').upsert({ name: newForm.customer_name, phone }, { onConflict: 'phone', ignoreDuplicates: true })
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
    await supabase.from('consultations').insert({
      date: selectedGroup.date,
      status: addForm.status,
      customer_name: selectedGroup.customer_name,
      phone: selectedGroup.phone,
      manager: selectedGroup.manager,
      recall_date: addForm.recall_date || null,
      content: addForm.content,
    })
    setSaving(false)
    setShowAddModal(false)
    setAddForm(emptyAdd)
    await fetchAll()
  }

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* 왼쪽: 고객 목록 */}
      <div className={`flex flex-col gap-4 min-w-0 transition-all ${selectedGroup ? 'w-1/2' : 'w-full'}`}>

        {/* 재상담 알림 */}
        {todayRecalls.length > 0 && (
          <div className="space-y-2">
            {todayRecalls.map(g => (
              <button
                key={g.phone}
                onClick={() => setSelectedPhone(g.phone)}
                className="w-full text-left bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2 hover:bg-amber-100 transition-colors"
              >
                <span className="text-sm">🔔</span>
                <span className="text-sm text-amber-800">
                  <span className="font-semibold">{g.customer_name}</span>님 재상담 날짜입니다.
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-gray-900">상담 관리</h1>
          <button
            onClick={() => { setNewForm(emptyNew); setPhoneDisplay(''); setShowNewModal(true) }}
            className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            신규 상담
          </button>
        </div>

        {/* 검색 · 상태 필터 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white">
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
              onChange={e => setSearchValue(e.target.value)}
              placeholder="검색"
              className="px-3 py-1.5 text-sm text-gray-900 outline-none w-36 bg-white"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => { setFilterStatus(''); router.replace('/admin/consulting') }}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors ${filterStatus === '' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              전체
            </button>
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => { setFilterStatus(s); router.replace(`/admin/consulting?status=${s}`) }}
                className={`px-2.5 py-1 rounded-full text-xs transition-colors ${filterStatus === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 고객 목록 테이블 */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">이름</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">연락처</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">담당자</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">최근 상태</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">재상담일</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">상담수</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                    상담 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredGroups.map(g => (
                  <tr
                    key={g.phone}
                    onClick={() => setSelectedPhone(selectedPhone === g.phone ? null : g.phone)}
                    className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${selectedPhone === g.phone ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
                  >
                    <td className="px-3 py-3 text-center text-gray-900 font-medium">{g.customer_name}</td>
                    <td className="px-3 py-3 text-center text-gray-500 whitespace-nowrap">{formatPhone(g.phone)}</td>
                    <td className="px-3 py-3 text-center text-gray-500">{g.manager}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[g.latest.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {g.latest.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-gray-500 whitespace-nowrap text-xs">
                      {g.latest.recall_date ?? '-'}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-500">{g.consultations.length}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 오른쪽: 상담 이력 패널 */}
      {selectedGroup && (
        <div className="w-1/2 flex flex-col min-w-0">
          <div className="bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 80px)' }}>
            {/* 고객 정보 헤더 */}
            <div className="px-5 py-4 border-b border-gray-200 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-900">{selectedGroup.customer_name}</h2>
                    <span className="text-sm text-gray-400">{formatPhone(selectedGroup.phone)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">담당자: {selectedGroup.manager} · 날짜: {selectedGroup.date}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setAddForm(emptyAdd); setShowAddModal(true) }}
                    className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap"
                  >
                    상담 추가
                  </button>
                  <button onClick={() => setSelectedPhone(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
                </div>
              </div>
            </div>

            {/* 상담 타임라인 */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {selectedGroup.consultations.map((c, i) => (
                <div key={c.id} className="px-5 py-4">
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
          </div>
        </div>
      )}

      {/* 신규 상담 모달 */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative z-10 bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-gray-900">신규 상담</p>
              <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-3 gap-3">
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
              <div>
                <label className="block text-xs text-gray-500 mb-1">담당자</label>
                <input type="text" value={newForm.manager} onChange={e => setNewForm(f => ({ ...f, manager: e.target.value }))}
                  placeholder="담당자명"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400" />
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
    </div>
  )
}
