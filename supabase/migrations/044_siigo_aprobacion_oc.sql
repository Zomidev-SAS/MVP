-- B12: punto de entrada explícito para "aprobar una OC y enviarla a Siigo".
--
-- DECISIÓN DE DISEÑO (documentar y avisar al frontend, tal como pide la
-- sección 7 del documento): el esquema real de ordenes_compra (025+028) no
-- tiene un estado "aprobada" — solo 'en_curso' | 'listo' | 'cancelada', que
-- son estados operativos, no de aprobación contable. En vez de adivinar en
-- qué transición de 'estado' debería dispararse el envío a Siigo (y arriesgar
-- un envío accidental), se expone una acción explícita: el panel llama a
-- rpc_aprobar_oc_siigo(orden_id) cuando compras/supervisor aprueba la orden.
-- Esto es lo que queda documentado en el contrato de datos (B11) para que el
-- frontend sepa exactamente cómo disparar el envío.

create or replace function rpc_aprobar_oc_siigo(p_orden_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden ordenes_compra%rowtype;
begin
  if get_user_rol() not in ('supervisor', 'compras') then
    raise exception 'Sin permiso para aprobar órdenes hacia Siigo';
  end if;

  select * into v_orden from ordenes_compra where id = p_orden_id for update;
  if not found then
    raise exception 'Orden de compra % no existe', p_orden_id;
  end if;

  if v_orden.estado = 'cancelada' then
    raise exception 'La orden % está cancelada, no se envía a Siigo', p_orden_id;
  end if;

  if v_orden.siigo_id is not null then
    -- Ya se creó en Siigo antes: idempotente, no se reenvía.
    return jsonb_build_object('ok', true, 'ya_sincronizada', true, 'siigo_id', v_orden.siigo_id);
  end if;

  update ordenes_compra set siigo_estado = 'enviando' where id = p_orden_id;

  perform fn_llamar_edge_function('siigo-sync-oc', jsonb_build_object('orden_id', p_orden_id));

  return jsonb_build_object('ok', true, 'ya_sincronizada', false);
end;
$$;

grant execute on function rpc_aprobar_oc_siigo(bigint) to authenticated;

-- Tabla de diferencias del catálogo nocturno (B12): nunca borra información
-- sola, solo registra lo que cambió para que alguien lo revise.
create table if not exists siigo_catalogo_diferencias (
  id            bigint generated always as identity primary key,
  tipo          text not null check (tipo in ('producto', 'proveedor')),
  codigo        text not null,
  campo         text not null,
  valor_panel   text,
  valor_siigo   text,
  revisado      boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_siigo_catalogo_diferencias_pendientes
  on siigo_catalogo_diferencias(revisado) where revisado = false;

alter table siigo_catalogo_diferencias enable row level security;

drop policy if exists siigo_catalogo_diferencias_select on siigo_catalogo_diferencias;
create policy siigo_catalogo_diferencias_select on siigo_catalogo_diferencias
  for select using (get_user_rol() in ('supervisor', 'compras', 'auditoria'));

grant select on siigo_catalogo_diferencias to authenticated;
