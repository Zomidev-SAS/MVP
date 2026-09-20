'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuthCallbackUrl } from '@/lib/supabase/auth-redirect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthCallbackUrl('/establecer-password'),
      })

      if (resetError) {
        setError('No se pudo enviar el correo. Verifica el email e intenta de nuevo.')
        return
      }

      setEnviado(true)
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/40 px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <CardTitle>Recuperar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          {enviado ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Si existe una cuenta con <strong>{email}</strong>, recibirás un correo con un
                enlace para crear una nueva contraseña. Revisa también spam.
              </p>
              <Link
                href="/login"
                className="inline-flex h-9 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
              >
                Volver al login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Escribe tu correo y te enviaremos un enlace para restablecer la contraseña.
              </p>
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
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </Button>
              <Link
                href="/login"
                className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Volver al login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
