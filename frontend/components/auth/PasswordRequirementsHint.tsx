import { Check, Circle } from 'lucide-react'
import { PASSWORD_REQUIREMENTS, PASSWORD_REQUIREMENTS_SUMMARY } from '@/lib/auth/password-policy'
import { cn } from '@/lib/utils'

export function PasswordRequirementsHint({ password }: { password: string }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Requisitos de contraseña segura
      </p>
      <ul className="space-y-1">
        {PASSWORD_REQUIREMENTS.map((req) => {
          const ok = password.length > 0 && req.test(password)
          return (
            <li
              key={req.id}
              className={cn(
                'flex items-center gap-2 text-xs',
                ok ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground'
              )}
            >
              {ok ? <Check className="h-3 w-3 shrink-0" /> : <Circle className="h-3 w-3 shrink-0" />}
              {req.label}
            </li>
          )
        })}
      </ul>
      {password.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{PASSWORD_REQUIREMENTS_SUMMARY}</p>
      )}
    </div>
  )
}
