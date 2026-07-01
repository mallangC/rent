'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProfileContext } from './profile-context'
import type { Profile } from './profile-context'

const baseTabs = [
  { label: '대시보드', href: '/admin' },
  { label: '상담 관리', href: '/admin/consulting' },
  { label: '고객 관리', href: '/admin/customers' },
  { label: '출고 내역', href: '/admin/deliveries' },
]
const adminTabs = [
  { label: '직원 관리', href: '/admin/staff' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [setupName, setSetupName] = useState('')
  const [saving, setSaving] = useState(false)


  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      setProfile(data as Profile ?? null)
    }
    load()
  }, [])

  async function saveSetup() {
    if (!setupName.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .insert({ id: user.id, name: setupName.trim(), role: '직원' })
      .select()
      .single()
    setProfile(data as Profile)
    setSaving(false)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (profile === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">로딩 중...</p>
      </div>
    )
  }

  if (profile === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm space-y-5">
          <div>
            <p className="text-base font-semibold text-gray-900">이름 설정</p>
            <p className="text-sm text-gray-400 mt-1">사이트에서 사용할 이름을 입력해주세요.</p>
          </div>
          <input
            type="text"
            value={setupName}
            onChange={e => setSetupName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveSetup()}
            placeholder="이름"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400"
          />
          <button
            onClick={saveSetup}
            disabled={saving || !setupName.trim()}
            className="w-full py-2.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '저장 중...' : '완료'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <ProfileContext.Provider value={profile}>
      <div className="min-h-screen flex bg-gray-50">
        <aside className="w-52 shrink-0 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-5 py-5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Rent 관리자</span>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {[...baseTabs, ...(profile.role === '관리자' ? adminTabs : [])].map(tab => {
              const isActive = pathname === tab.href
              return (
                <button
                  key={tab.href}
                  onClick={() => router.push(tab.href)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </nav>

          <div className="px-3 py-4 border-t border-gray-100 space-y-1">
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-gray-900">{profile.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{profile.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>

    </ProfileContext.Provider>
  )
}
