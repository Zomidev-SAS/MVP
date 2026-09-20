'use client'

import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PasswordRequirementsHint } from '@/components/auth/PasswordRequirementsHint'
import { isPasswordValid } from '@/lib/auth/password-policy'
import { cambiarPassword } from '@/lib/supabase/cuenta-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Profile } from '@/lib/types/database'

export function CuentaForm({
  email,
  profile,
}: {
  email: string
  profile: Profile
}) {
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNueva, setPasswordNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!isPasswordValid(passwordNueva)) {
      setError('La nueva contraseña no cumple los requisitos de seguridad.')
      return
    }
    if (passwordNueva !== confirmar) {
      setError('La confirmación no coincide con la nueva contraseña.')
      return
    }

    setLoading(true)
    const resultado = await cambiarPassword({ passwordActual, passwordNueva })
    setLoading(false)

    if (!resultado.ok) {
      setError(resultado.error)
      return
    }

    setPasswordActual('')
    setPasswordNueva('')
    setConfirmar('')
    toast.success('Contraseña actualizada correctamente.')
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos de la cuenta</CardTitle>
          <CardDescription>Información de tu perfil en el panel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Nombre</p>
            <p className="font-medium">{profile.nombre || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Correo</p>
            <p className="font-medium">{email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Rol</p>
            <p className="font-medium capitalize">{profile.rol}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
          <CardDescription>
            Debes conocer tu contraseña actual. Si la olvidaste, cierra sesión y usa
            &quot;¿Olvidaste tu contraseña?&quot; en el login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password-actual">Contraseña actual</Label>
              <Input
                id="password-actual"
                type="password"
                required
                autoComplete="current-password"
                value={passwordActual}
                onChange={(e) => setPasswordActual(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-nueva">Nueva contraseña</Label>
              <Input
                id="password-nueva"
                type="password"
                required
                autoComplete="new-password"
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
              />
              <PasswordRequirementsHint password={passwordNueva} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-confirmar">Confirmar nueva contraseña</Label>
              <Input
                id="password-confirmar"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button
              type="submit"
              disabled={loading || !isPasswordValid(passwordNueva) || passwordNueva !== confirmar}
            >
              {loading ? 'Guardando...' : 'Actualizar contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
