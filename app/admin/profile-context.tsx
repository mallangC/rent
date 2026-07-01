'use client'

import { createContext, useContext } from 'react'

export type Profile = {
  id: string
  name: string
  role: '관리자' | '직원'
}

export const ProfileContext = createContext<Profile | null>(null)
export const useProfile = () => useContext(ProfileContext)
