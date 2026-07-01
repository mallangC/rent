import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== '관리자') return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const admin = createAdminClient()
  const { data: { users }, error } = await admin.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profiles } = await admin.from('profiles').select('*')
  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  const staff = users.map(u => ({
    id: u.id,
    email: u.email ?? '',
    name: profileMap.get(u.id)?.name ?? '(미설정)',
    role: profileMap.get(u.id)?.role ?? '직원',
    created_at: u.created_at,
  }))

  return NextResponse.json(staff)
}
