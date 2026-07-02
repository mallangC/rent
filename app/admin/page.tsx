'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length < 4) return digits
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

type Consultation = {
  id: string
  created_at: string
  updated_at: string
  date: string
  status: string
  customer_name: string
  phone: string
  manager: string
  content: string
}

type Stats = {
  total: number
  contracted: number
  prospect: number
  delivered: number
  todayRecall: number
  statusCounts: Record<string, number>
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats>({
    total: 0,
    contracted: 0,
    prospect: 0,
    delivered: 0,
    todayRecall: 0,
    statusCounts: {},
  })
  const [recents, setRecents] = useState<Consultation[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: consultations } = await supabase
        .from('consultations')
        .select('*')
        .order('created_at', { ascending: false })

      if (!consultations) return

      const { data: customers } = await supabase.from('customers').select('id')

      // 전화번호 기준 최신 상담만 추출
      const today = new Date()
      const todayStr = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-')
      const latestByPhone = new Map<string, typeof consultations[0]>()
      consultations.forEach(c => {
        const existing = latestByPhone.get(c.phone)
        if (!existing || new Date(c.created_at) > new Date(existing.created_at)) {
          latestByPhone.set(c.phone, c)
        }
      })
      const latestList = [...latestByPhone.values()]

      // 최신 상담 기준으로 상태 집계
      const statusCounts: Record<string, number> = {}
      STATUSES.forEach(s => { statusCounts[s] = 0 })
      latestList.forEach(c => {
        if (statusCounts[c.status] !== undefined) statusCounts[c.status]++
      })

      const todayRecall = latestList.filter(c => c.recall_date === todayStr).length

      setStats({
        total: customers?.length ?? 0,
        contracted: statusCounts['계약'] ?? 0,
        prospect: statusCounts['가망'] ?? 0,
        delivered: statusCounts['출고'] ?? 0,
        todayRecall,
        statusCounts,
      })

      const { data: recentData } = await supabase
        .from('consultations')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(3)

      setRecents(recentData ?? [])
    }
    load()
  }, [])

  const totalConsultations = Object.values(stats.statusCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      {/* 상단 5개 지표 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: '전체고객', value: stats.total },
          { label: '계약고객', value: stats.contracted },
          { label: '가망고객', value: stats.prospect },
          { label: '출고완료', value: stats.delivered },
          { label: '오늘 재상담', value: stats.todayRecall, highlight: stats.todayRecall > 0 },
        ].map(item => (
          <div key={item.label} className={`border rounded-lg p-4 ${'highlight' in item && item.highlight ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
            <p className={`text-xs ${'highlight' in item && item.highlight ? 'text-amber-600' : 'text-gray-500'}`}>{item.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${'highlight' in item && item.highlight ? 'text-amber-700' : 'text-gray-900'}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* 상태별 고객 현황 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-700">상태별 고객현황</span>
        </div>
        <div className="flex bg-white">
          {STATUSES.map((status, i) => {
            const count = stats.statusCounts[status] ?? 0
            const pct = totalConsultations > 0 ? Math.round((count / totalConsultations) * 100) : 0
            return (
              <button
                key={status}
                onClick={() => router.push(`/admin/consulting?status=${status}`)}
                className={`flex-1 flex flex-col items-center py-4 hover:bg-gray-50 transition-colors ${i !== 0 ? 'border-l border-gray-200' : ''}`}
              >
                <span className="text-xs text-gray-600">{status}</span>
                <span className="text-lg font-semibold text-gray-900 mt-1">{count}</span>
                <span className="text-xs text-gray-400 mt-0.5">{pct}%</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 최근 상담 고객 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-700">최근 상담 고객</span>
        </div>
        <div className="bg-white divide-y divide-gray-100">
          {recents.length === 0 ? (
            <p className="text-sm text-gray-400 px-4 py-4">상담 내역이 없습니다.</p>
          ) : (
            recents.map(item => (
              <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{item.customer_name}</span>
                      <span className="text-xs text-gray-400">{formatPhone(item.phone)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-gray-400">{item.date}</span>
                      <span className="text-gray-200 text-xs">·</span>
                      <span className="text-xs text-gray-400">{item.manager}</span>
                      {item.content && (
                        <>
                          <span className="text-gray-200 text-xs">·</span>
                          <span className="text-xs text-gray-400 truncate max-w-[200px]">{item.content}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[item.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {item.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
