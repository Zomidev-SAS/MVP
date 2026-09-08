import type { UsuarioListado } from '@/lib/types/usuarios'

export function getDevPreviewUsuariosData(): UsuarioListado[] {
  return [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      nombre: 'Ana Martínez',
      rol: 'supervisor',
      activo: true,
      created_at: '2026-01-10T08:00:00.000Z',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000002',
      nombre: 'Carlos Ruiz',
      rol: 'comercial',
      activo: true,
      created_at: '2026-01-15T08:00:00.000Z',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000003',
      nombre: 'Diana Gómez',
      rol: 'ingenieria',
      activo: true,
      created_at: '2026-02-01T08:00:00.000Z',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000004',
      nombre: 'Esteban Torres',
      rol: 'produccion',
      activo: false,
      created_at: '2026-02-10T08:00:00.000Z',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000005',
      nombre: 'Fernanda López',
      rol: 'compras',
      activo: true,
      created_at: '2026-02-20T08:00:00.000Z',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000006',
      nombre: 'Gabriel Ortiz',
      rol: 'auditoria',
      activo: false,
      created_at: '2026-03-01T08:00:00.000Z',
    },
  ]
}
