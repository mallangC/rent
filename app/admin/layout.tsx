'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const tabs = [
  { label: '대시보드', href: '/admin' },
  { label: '상담 관리', href: '/admin/consulting' },
  { label: '고객 관리', href: '/admin/customers' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* 왼쪽 사이드바 */}
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

        <div className="px-3 py-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* 본문 */}
      <main className="flex-1 p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
