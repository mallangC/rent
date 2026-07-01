import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { email, password, name, role } = await req.json()
  if (!email || !password || !name) return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 })

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (callerProfile?.role !== '관리자') return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const admin = createAdminClient()
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('profiles').insert({
    id: created.user.id,
    name,
    role: role ?? '직원',
  })

  return NextResponse.json({ ok: true })
}
