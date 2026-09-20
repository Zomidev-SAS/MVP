'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordRequirementsHint } from '@/components/auth/PasswordRequirementsHint'
import { isPasswordValid } from '@/lib/auth/password-policy'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function EstablecerPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [listo, setListo] = useState(false)
  const [esRecuperacion, setEsRecuperacion] = useState(false)
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) {
        setListo(true)
        setEsRecuperacion(event === 'PASSWORD_RECOVERY')
        setError(null)
        setVerificando(false)
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setListo(true)
        setVerificando(false)
        return
      }

      window.setTimeout(() => {
        supabase.auth.getSession().then(({ data: retry }) => {
          setVerificando(false)
          if (!retry.session) {
            setError(
              'El enlace no es válido o ya expiró. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".'
            )
          }
        })
      }, 800)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!isPasswordValid(password)) {
      setError('La contraseña no cumple los requisitos de seguridad.')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError('No se pudo guardar la contraseña. Intenta de nuevo.')
      return
    }

    await supabase.auth.signOut()
    router.push('/login')
  }

  const titulo = esRecuperacion ? 'Nueva contraseña' : 'Crear tu contraseña'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/40 px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
        </CardHeader>
        <CardContent>
          {verificando && !error && (
            <p className="text-sm text-muted-foreground">Verificando enlace...</p>
          )}
          {listo && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <PasswordRequirementsHint password={password} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmar">Confirmar contraseña</Label>
                <Input
                  id="confirmar"
                  type="password"
                  required
                  minLength={8}
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !isPasswordValid(password) || password !== confirmar}
              >
                {loading ? 'Guardando...' : 'Guardar y continuar'}
              </Button>
            </form>
          )}
          {!listo && !verificando && error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
