create table movimientos_inventario (
  id              bigint generated always as identity primary key,
  vin             text not null check (length(trim(vin)) >= 5),
  tipo_movimiento text not null check (tipo_movimiento in (
                     'entrada','salida_vin','ajuste','reverso')),
  cantidad        numeric(12,2) not null,
  valor_unitario  numeric(14,2),
  marca           text,
  categoria       text,
  ubicacion       text,
  formulario_id   text references formularios(id),
  motivo          text,
  evidencia       jsonb not null default '{}',
  actor_id        uuid not null references auth.users(id),
  aprobado_por    uuid references auth.users(id),
  estado          text not null default 'aplicado'
                    check (estado in ('pendiente','aplicado','rechazado')),
  idempotency_key text unique,
  created_at      timestamptz not null default now()
);

create index idx_mov_vin          on movimientos_inventario(vin);
create index idx_mov_tipo_fecha   on movimientos_inventario(tipo_movimiento, created_at desc);
create index idx_mov_formulario   on movimientos_inventario(formulario_id) where formulario_id is not null;
create index idx_mov_idempotency  on movimientos_inventario(idempotency_key) where idempotency_key is not null;
create index idx_mov_estado_fecha on movimientos_inventario(estado, created_at desc);

create rule no_update_movimientos as on update to movimientos_inventario do instead nothing;
create rule no_delete_movimientos as on delete to movimientos_inventario do instead nothing;