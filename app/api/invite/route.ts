import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: '이메일을 입력해주세요.' }, { status: 400 })

  // 호출자가 관리자인지 확인
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== '관리자') {
    return NextResponse.json({ error: '관리자만 초대할 수 있습니다.' }, { status: 403 })
  }

  // 초대 이메일 발송
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${req.nextUrl.origin}/admin`,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
