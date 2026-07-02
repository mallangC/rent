import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { userId, role } = await req.json()
  if (!userId || !role) return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 })
  if (role !== '관리자' && role !== '직원') return NextResponse.json({ error: '유효하지 않은 역할입니다.' }, { status: 400 })

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  if (user.id === userId) return NextResponse.json({ error: '자신의 역할은 변경할 수 없습니다.' }, { status: 403 })

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (callerProfile?.role !== '관리자') return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ role }).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
