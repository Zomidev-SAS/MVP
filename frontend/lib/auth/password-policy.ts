export const PASSWORD_REQUIREMENTS = [
  { id: 'length', label: 'Al menos 8 caracteres', test: (p: string) => p.length >= 8 },
  { id: 'upper', label: 'Una letra mayúscula', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'Una letra minúscula', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'Un número', test: (p: string) => /[0-9]/.test(p) },
  {
    id: 'special',
    label: 'Un carácter especial (!@#$%&*...)',
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
] as const

export function isPasswordValid(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((req) => req.test(password))
}

export function validatePassword(password: string): { ok: true } | { ok: false; error: string } {
  const failed = PASSWORD_REQUIREMENTS.find((req) => !req.test(password))
  if (failed) {
    return { ok: false, error: `La contraseña debe cumplir: ${failed.label.toLowerCase()}.` }
  }
  return { ok: true }
}

export const PASSWORD_REQUIREMENTS_SUMMARY =
  'Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter especial.'
