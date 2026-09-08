'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

      router.push('/')
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/40 px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="flex flex-col items-center space-y-3 pb-2 text-center">
          <Image
            src="/logo_fondo.jpeg"
            alt="Carrera Arango"
            width={160}
            height={226}
            className="h-40 w-auto rounded-md object-contain"
            priority
          />
          <div className="space-y-1">
            <CardTitle className="text-xl">Iniciar sesión</CardTitle>
            <p className="text-sm text-muted-foreground">Panel de Inventario</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@carreraarango.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </Button>
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed text-center text-sm text-muted-foreground opacity-50"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
