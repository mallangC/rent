'use client'

import { useEffect, useRef, useState } from 'react'

type StaffMember = {
  id: string
  email: string
  name: string
  role: '관리자' | '직원'
  created_at: string
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  // 계정 생성 모달
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', password: '', name: '', role: '직원' })
  const [creating, setCreating] = useState(false)
  const [createResult, setCreateResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // 비밀번호 변경 모달
  const [showPwModal, setShowPwModal] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [changingPw, setChangingPw] = useState(false)
  const [pwResult, setPwResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // ··· 드롭다운
  const [optionsOpen, setOptionsOpen] = useState<string | null>(null)
  const [optionsPos, setOptionsPos] = useState({ top: 0, left: 0 })
  const optionsRef = useRef<HTMLDivElement>(null)

  // 이름 변경 모달
  const [showNameModal, setShowNameModal] = useState(false)
  const [nameTarget, setNameTarget] = useState<StaffMember | null>(null)
  const [newName, setNewName] = useState('')
  const [changingName, setChangingName] = useState(false)
  const [nameResult, setNameResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function fetchStaff() {
    setLoading(true)
    const res = await fetch('/api/staff/list')
    const data = await res.json()
    setStaff(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { void fetchStaff() }, [])

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
    setOptionsPos({ top: rect.bottom + window.scrollY + 4, left: rect.right + window.scrollX - 120 })
    setOptionsOpen(prev => prev === id ? null : id)
  }

  async function createAccount() {
    if (!createForm.email || !createForm.password || !createForm.name) return
    setCreating(true)
    setCreateResult(null)
    const res = await fetch('/api/staff/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    })
    const data = await res.json()
    if (res.ok) {
      setCreateResult({ ok: true, msg: '계정이 생성되었습니다.' })
      setCreateForm({ email: '', password: '', name: '', role: '직원' })
      await fetchStaff()
    } else {
      setCreateResult({ ok: false, msg: data.error ?? '오류가 발생했습니다.' })
    }
    setCreating(false)
  }

  async function changePassword() {
    if (!selectedStaff || !newPassword) return
    setChangingPw(true)
    setPwResult(null)
    const res = await fetch('/api/staff/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selectedStaff.id, password: newPassword }),
    })
    const data = await res.json()
    if (res.ok) {
      setPwResult({ ok: true, msg: '비밀번호가 변경되었습니다.' })
      setNewPassword('')
    } else {
      setPwResult({ ok: false, msg: data.error ?? '오류가 발생했습니다.' })
    }
    setChangingPw(false)
  }

  function openPwModal(member: StaffMember) {
    setSelectedStaff(member)
    setNewPassword('')
    setPwResult(null)
    setShowPwModal(true)
  }

  function openNameModal(member: StaffMember) {
    setNameTarget(member)
    setNewName(member.name)
    setNameResult(null)
    setShowNameModal(true)
  }

  async function changeName() {
    if (!nameTarget || !newName.trim()) return
    setChangingName(true)
    setNameResult(null)
    const res = await fetch('/api/staff/name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: nameTarget.id, name: newName.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setNameResult({ ok: true, msg: '이름이 변경되었습니다.' })
      setStaff(prev => prev.map(s => s.id === nameTarget.id ? { ...s, name: newName.trim() } : s))
    } else {
      setNameResult({ ok: false, msg: data.error ?? '오류가 발생했습니다.' })
    }
    setChangingName(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">직원 관리</h1>
        <button
          onClick={() => { setShowCreateModal(true); setCreateResult(null); setCreateForm({ email: '', password: '', name: '', role: '직원' }) }}
          className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
        >
          계정 생성
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">이름</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">이메일</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500">역할</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500">가입일</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 w-24">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">로딩 중...</td>
              </tr>
            ) : staff.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">등록된 직원이 없습니다.</td>
              </tr>
            ) : (
              staff.map(member => (
                <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{member.name}</td>
                  <td className="px-4 py-3 text-gray-500">{member.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${member.role === '관리자' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-400">
                    {new Date(member.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={e => openOptions(e, member.id)}
                      className="text-gray-900 hover:text-gray-600 px-1 leading-none text-base transition-colors"
                    >
                      ···
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ··· 드롭다운 */}
      {optionsOpen && (
        <div
          ref={optionsRef}
          style={{ top: optionsPos.top, left: optionsPos.left }}
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-32"
        >
          {(() => {
            const target = staff.find(s => s.id === optionsOpen)
            if (!target) return null
            return (
              <>
                <button
                  onClick={() => { setOptionsOpen(null); openNameModal(target) }}
                  className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  이름 변경
                </button>
                <button
                  onClick={() => { setOptionsOpen(null); openPwModal(target) }}
                  className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  비밀번호 변경
                </button>
              </>
            )
          })()}
        </div>
      )}

      {/* 계정 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowCreateModal(false)} />
          <div className="relative z-10 bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-gray-900">계정 생성</p>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">이름</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="직원 이름"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">이메일</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="이메일 주소"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">비밀번호</label>
                <input
                  type="text"
                  value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="초기 비밀번호"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">역할</label>
                <select
                  value={createForm.role}
                  onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 bg-white"
                >
                  <option>직원</option>
                  <option>관리자</option>
                </select>
              </div>
            </div>

            {createResult && (
              <p className={`text-sm ${createResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                {createResult.msg}
              </p>
            )}

            <button
              onClick={createAccount}
              disabled={creating || !createForm.email || !createForm.password || !createForm.name}
              className="w-full py-2.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {creating ? '생성 중...' : '계정 생성'}
            </button>
          </div>
        </div>
      )}

      {/* 이름 변경 모달 */}
      {showNameModal && nameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowNameModal(false)} />
          <div className="relative z-10 bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-gray-900">이름 변경</p>
                <p className="text-xs text-gray-400 mt-0.5">{nameTarget.email}</p>
              </div>
              <button onClick={() => setShowNameModal(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">새 이름</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && changeName()}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400"
              />
            </div>
            {nameResult && (
              <p className={`text-sm ${nameResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                {nameResult.msg}
              </p>
            )}
            <button
              onClick={changeName}
              disabled={changingName || !newName.trim()}
              className="w-full py-2.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {changingName ? '변경 중...' : '변경'}
            </button>
          </div>
        </div>
      )}

      {/* 비밀번호 변경 모달 */}
      {showPwModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowPwModal(false)} />
          <div className="relative z-10 bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-gray-900">비밀번호 변경</p>
                <p className="text-xs text-gray-400 mt-0.5">{selectedStaff.name} · {selectedStaff.email}</p>
              </div>
              <button onClick={() => setShowPwModal(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">새 비밀번호</label>
              <input
                type="text"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && changePassword()}
                placeholder="새 비밀번호 입력"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder:text-gray-400"
              />
            </div>

            {pwResult && (
              <p className={`text-sm ${pwResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                {pwResult.msg}
              </p>
            )}

            <button
              onClick={changePassword}
              disabled={changingPw || !newPassword}
              className="w-full py-2.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {changingPw ? '변경 중...' : '변경'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
