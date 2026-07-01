'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProfileContext } from './profile-context'
import type { Profile } from './profile-context'

const tabs = [
  { label: '대시보드', href: '/admin' },
  { label: '상담 관리', href: '/admin/consulting' },
  { label: '고객 관리', href: '/admin/customers' },
  { label: '출고 내역', href: '/admin/deliveries' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [setupName, setSetupName] = useState('')
  const [saving, setSaving] = useState(false)

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; msg: string } | null>(null)

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

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteResult(null)
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setInviteResult({ ok: true, msg: '초대 이메일을 발송했습니다.' })
      setInviteEmail('')
    } else {
      setInviteResult({ ok: false, msg: data.error ?? '오류가 발생했습니다.' })
    }
    setInviting(false)
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
            {tabs.map(tab => {
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
            {profile.role === '관리자' && (
              <button
                onClick={() => { setShowInviteModal(true); setInviteResult(null); setInviteEmail('') }}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              >
                직원 초대
              </button>
            )}
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

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowInviteModal(false)} />
          <div className="relative z-10 bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-gray-900">직원 초대</p>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-400">초대할 직원의 이메일을 입력하면 초대 링크를 발송합니다.</p>
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendInvite()}
              placeholder="이메일 주소"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400"
            />
            {inviteResult && (
              <p className={`text-sm ${inviteResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                {inviteResult.msg}
              </p>
            )}
            <button
              onClick={sendInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="w-full py-2.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {inviting ? '발송 중...' : '초대 보내기'}
            </button>
          </div>
        </div>
      )}
    </ProfileContext.Provider>
  )
}
