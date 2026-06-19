'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const STATUSES = ['기본', '불량', '부재', '관리', '가망', '계약', '출고'] as const

type Consultation = {
  id: string
  created_at: string
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
  statusCounts: Record<string, number>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    contracted: 0,
    prospect: 0,
    delivered: 0,
    statusCounts: {},
  })
  const [recent, setRecent] = useState<Consultation | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: consultations } = await supabase
        .from('consultations')
        .select('*')
        .order('created_at', { ascending: false })

      if (!consultations) return

      const statusCounts: Record<string, number> = {}
      STATUSES.forEach(s => { statusCounts[s] = 0 })
      consultations.forEach(c => {
        if (statusCounts[c.status] !== undefined) statusCounts[c.status]++
      })

      const { data: customers } = await supabase.from('customers').select('id')

      setStats({
        total: customers?.length ?? 0,
        contracted: statusCounts['계약'] ?? 0,
        prospect: statusCounts['가망'] ?? 0,
        delivered: statusCounts['출고'] ?? 0,
        statusCounts,
      })
      setRecent(consultations[0] ?? null)
    }
    load()
  }, [])

  const totalConsultations = Object.values(stats.statusCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      {/* 상단 4개 지표 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '전체고객', value: stats.total },
          { label: '계약고객', value: stats.contracted },
          { label: '가망고객', value: stats.prospect },
          { label: '출고완료', value: stats.delivered },
        ].map(item => (
          <div key={item.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{item.value}</p>
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
              <div
                key={status}
                className={`flex-1 flex flex-col items-center py-4 ${i !== 0 ? 'border-l border-gray-200' : ''}`}
              >
                <span className="text-xs text-gray-600">{status}</span>
                <span className="text-lg font-semibold text-gray-900 mt-1">{count}</span>
                <span className="text-xs text-gray-400 mt-0.5">{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 최근 상담 내역 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-700">최근 상담 내역</span>
        </div>
        <div className="bg-white px-4 py-3">
          {recent ? (
            <div className="text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-medium text-gray-900">{recent.customer_name}</span>
                  <span className="ml-2 text-gray-500">{recent.phone}</span>
                </div>
                <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                  {recent.status}
                </span>
              </div>
              <div className="mt-1 text-gray-500">
                <span>{recent.date}</span>
                <span className="mx-1">·</span>
                <span>{recent.manager}</span>
              </div>
              {recent.content && (
                <p className="mt-1 text-gray-600 line-clamp-2">{recent.content}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">상담 내역이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  )
}
