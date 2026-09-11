create table ajustes_pendientes (
  id                  bigint generated always as identity primary key,
  movimiento_borrador jsonb not null,
  solicitado_por      uuid not null references auth.users(id),
  estado              text not null default 'pendiente'
                         check (estado in ('pendiente','aprobado','rechazado')),
  motivo_rechazo      text,
  resuelto_por        uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  resuelto_at         timestamptz
);