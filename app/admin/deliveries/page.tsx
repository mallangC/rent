'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '../profile-context'

type Delivery = {
  id: string
  created_at: string
  customer_name: string
  phone: string
  vehicle_price: number | null
  acquisition_rate: number | null
  ag_rate: number | null
  financial_company: string | null
  notes: string | null
  user_id: string
  manager_name: string | null
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

function formatNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits).toLocaleString() : ''
}

function parseNumber(value: string): number | null {
  const n = Number(value.replace(/,/g, ''))
  return isNaN(n) || value === '' ? null : n
}

const emptyForm = {
  customer_name: '',
  phone: '',
  phoneDisplay: '',
  vehicle_price: '',
  acquisition_rate: '',
  ag_rate: '',
  financial_company: '',
  notes: '',
}

const PAGE_SIZE = 15

export default function DeliveriesPage() {
  const profile = useProfile()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [searchType, setSearchType] = useState<'고객명' | '고객번호'>('고객명')
  const [searchValue, setSearchValue] = useState('')
  const [page, setPage] = useState(0)

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [optionsOpen, setOptionsOpen] = useState<string | null>(null)
  const [optionsPos, setOptionsPos] = useState({ top: 0, left: 0 })
  const optionsRef = useRef<HTMLDivElement>(null)

  async function fetchAll() {
    const supabase = createClient()
    const { data } = await supabase
      .from('deliveries')
      .select('*')
      .order('created_at', { ascending: false })
    setDeliveries(data ?? [])
  }

  useEffect(() => { void fetchAll() }, [])

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

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(d: Delivery) {
    setEditingId(d.id)
    setForm({
      customer_name: d.customer_name,
      phone: stripPhone(d.phone),
      phoneDisplay: formatPhone(d.phone),
      vehicle_price: d.vehicle_price != null ? d.vehicle_price.toLocaleString() : '',
      acquisition_rate: d.acquisition_rate != null ? String(d.acquisition_rate) : '',
      ag_rate: d.ag_rate != null ? String(d.ag_rate) : '',
      financial_company: d.financial_company ?? '',
      notes: d.notes ?? '',
    })
    setOptionsOpen(null)
    setShowModal(true)
  }

  async function save() {
    if (!form.customer_name || !form.phone) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      customer_name: form.customer_name,
      phone: stripPhone(form.phone),
      vehicle_price: parseNumber(form.vehicle_price),
      acquisition_rate: parseNumber(form.acquisition_rate),
      ag_rate: parseNumber(form.ag_rate),
      financial_company: form.financial_company || null,
      notes: form.notes || null,
      user_id: user?.id,
      manager_name: profile?.name ?? null,
    }
    if (editingId) {
      await supabase.from('deliveries').update(payload).eq('id', editingId)
    } else {
      await supabase.from('deliveries').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    setEditingId(null)
    setForm(emptyForm)
    await fetchAll()
  }

  async function deleteDelivery(id: string) {
    if (!confirm('이 출고내역을 삭제하시겠습니까?')) return
    setOptionsOpen(null)
    const supabase = createClient()
    await supabase.from('deliveries').delete().eq('id', id)
    await fetchAll()
  }

  const filtered = deliveries.filter(d => {
    if (!searchValue) return true
    if (searchType === '고객명') return d.customer_name.includes(searchValue)
    return d.phone.includes(stripPhone(searchValue))
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const isAdmin = profile?.role === '관리자'
  const colCount = isAdmin ? 8 : 7


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">출고 내역</h1>
        <button
          onClick={openAdd}
          className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
        >
          내역 추가
        </button>
      </div>

      {/* 검색 */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <select
            value={searchType}
            onChange={e => { setSearchType(e.target.value as '고객명' | '고객번호'); setSearchValue(''); setPage(0) }}
            className="text-sm text-gray-500 bg-transparent outline-none border-r border-gray-200 pr-2 mr-1"
          >
            <option>고객명</option>
            <option>고객번호</option>
          </select>
          <input
            type="text"
            value={searchValue}
            onChange={e => { setSearchValue(e.target.value); setPage(0) }}
            placeholder="검색"
            className="flex-1 text-sm text-gray-900 outline-none placeholder:text-gray-400 bg-transparent"
          />
          {searchValue && (
            <button onClick={() => { setSearchValue(''); setPage(0) }} className="text-gray-300 hover:text-gray-500 text-lg leading-none">×</button>
          )}
        </div>
      </div>

      {/* 목록 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap">고객명</th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap">고객번호</th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap">차량가</th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap">취득원가%</th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap">AG%</th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap">금융사</th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap">특이사항</th>
              {isAdmin && <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap">담당자</th>}
              <th className="px-3 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <>
                <tr>
                  <td colSpan={colCount + 1} className="px-4 py-10 text-center text-sm text-gray-400">
                    출고 내역이 없습니다.
                  </td>
                </tr>
                {Array.from({ length: PAGE_SIZE - 1 }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-gray-100">
                    <td colSpan={colCount + 1} className="h-[45px]" />
                  </tr>
                ))}
              </>
            ) : (
              <>
                {paged.map(d => (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 text-center text-gray-900 font-medium whitespace-nowrap">{d.customer_name}</td>
                    <td className="px-3 py-3 text-center text-gray-500 whitespace-nowrap">{formatPhone(d.phone)}</td>
                    <td className="px-3 py-3 text-center text-gray-700 whitespace-nowrap">
                      {d.vehicle_price != null ? d.vehicle_price.toLocaleString() : '-'}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-500 whitespace-nowrap">
                      {d.acquisition_rate != null ? `${d.acquisition_rate}%` : '-'}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-500 whitespace-nowrap">
                      {d.ag_rate != null ? `${d.ag_rate}%` : '-'}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-500 whitespace-nowrap">{d.financial_company ?? '-'}</td>
                    <td className="px-3 py-3 text-gray-500 max-w-[160px] truncate">{d.notes ?? '-'}</td>
                    {isAdmin && (
                      <td className="px-3 py-3 text-center text-gray-500 whitespace-nowrap text-xs">
                        {d.manager_name ?? '-'}
                      </td>
                    )}
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={e => openOptions(e, d.id)}
                        className="text-gray-400 hover:text-gray-700 px-1 leading-none text-base transition-colors"
                      >
                        ···
                      </button>
                    </td>
                  </tr>
                ))}
                {Array.from({ length: PAGE_SIZE - paged.length }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-gray-100">
                    <td colSpan={colCount + 1} className="h-[45px]" />
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

      {/* 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowModal(false)} />
          <div className="relative z-10 bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-gray-900">{editingId ? '출고내역 수정' : '출고내역 추가'}</p>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">고객명</label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                  placeholder="고객명"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">고객번호</label>
                <input
                  type="text"
                  value={form.phoneDisplay}
                  onChange={e => {
                    const formatted = formatPhone(e.target.value)
                    setForm(f => ({ ...f, phoneDisplay: formatted, phone: stripPhone(formatted) }))
                  }}
                  placeholder="010-0000-0000"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">차량가</label>
                <input
                  type="text"
                  value={form.vehicle_price}
                  onChange={e => setForm(f => ({ ...f, vehicle_price: formatNumber(e.target.value) }))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">금융사</label>
                <input
                  type="text"
                  value={form.financial_company}
                  onChange={e => setForm(f => ({ ...f, financial_company: e.target.value }))}
                  placeholder="금융사명"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">취득원가 %</label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.acquisition_rate}
                    onChange={e => setForm(f => ({ ...f, acquisition_rate: e.target.value.replace(/[^0-9.]/g, '') }))}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-6 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">AG %</label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.ag_rate}
                    onChange={e => setForm(f => ({ ...f, ag_rate: e.target.value.replace(/[^0-9.]/g, '') }))}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-6 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">특이사항</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={6}
                placeholder="특이사항을 입력하세요"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 resize-none placeholder:text-gray-400"
              />
            </div>

            <button
              onClick={save}
              disabled={saving || !form.customer_name || !form.phone}
              className="w-full py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* ··· 드롭다운 */}
      {optionsOpen && (
        <div
          ref={optionsRef}
          style={{ top: optionsPos.top, left: optionsPos.left }}
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-24"
        >
          {(() => {
            const target = deliveries.find(d => d.id === optionsOpen)
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
                  onClick={() => deleteDelivery(target.id)}
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
