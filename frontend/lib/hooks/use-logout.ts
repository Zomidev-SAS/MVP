'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function useLogout() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function logout() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Failed to sign out:', error)
        return
      }
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Failed to sign out:', error)
    } finally {
      setLoading(false)
    }
  }

  return { logout, loading }
}
