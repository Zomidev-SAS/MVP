'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { JUST_LOGGED_IN_KEY } from '@/lib/auth/just-logged-in'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError('Credenciales inválidas. Verifica tu correo y contraseña.')
        return
      }

      sessionStorage.setItem(JUST_LOGGED_IN_KEY, '1')
      router.push('/')
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="auth-card-enter w-full max-w-sm gap-0 py-0 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.25)] ring-primary/10">
        <div className="h-1 w-full bg-gradient-to-r from-primary to-primary/50" />

        <CardHeader className="flex flex-col items-center space-y-4 pb-2 pt-8 text-center">
          <Image
            src="/logo_fondo.jpeg"
            alt="Carrera Arango"
            width={160}
            height={226}
            className="h-40 w-auto rounded-md object-contain"
            priority
          />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
            <p className="text-sm text-muted-foreground">Panel de Inventario</p>
          </div>
        </CardHeader>

        <CardContent className="pb-8 pt-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Correo electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  aria-invalid={!!error}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@carreraarango.com"
                  className="h-11 border-transparent bg-muted/60 focus-visible:bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={mostrarPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    aria-invalid={!!error}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 border-transparent bg-muted/60 pr-9 focus-visible:bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {mostrarPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <Button
                type="submit"
                className="btn-hover-lift h-11 w-full"
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Ingresando...' : 'Iniciar sesión'}
              </Button>
              <Link
                href="/recuperar-password"
                className="block w-full text-center text-sm text-primary underline-offset-4 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="absolute inset-x-0 bottom-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Carrera Arango Transformaciones S.A.S. Todos los derechos
        reservados.
      </p>
    </div>
  )
}
