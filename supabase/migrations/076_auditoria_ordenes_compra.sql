-- 076: historial de cambios de las órdenes de compra (quién y cuándo).
--
-- Compras y supervisor pueden reabrir y modificar órdenes ya cerradas; cada vez queda
-- una fila aquí con la persona, la hora, el motivo y el detalle de lo que cambió.
-- Solo se agrega: no hay políticas de UPDATE ni DELETE para los usuarios.
--
-- Además reabre la OC 3758, que se cerró por equivocación sin haber entregado el pedido.

begin;

create table if not exists ordenes_compra_auditoria (
  id         bigint generated always as identity primary key,
  orden_id   bigint not null references ordenes_compra(id) on delete cascade,
  accion     text   not null check (accion in ('reabrir', 'editar_cerrada', 'releer_documento', 'correccion')),
  motivo     text,
  detalle    jsonb  not null default '{}'::jsonb,
  usuario_id uuid   not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_oc_auditoria_orden on ordenes_compra_auditoria (orden_id, created_at desc);

alter table ordenes_compra_auditoria enable row level security;

drop policy if exists oc_auditoria_select on ordenes_compra_auditoria;
create policy oc_auditoria_select on ordenes_compra_auditoria
  for select using (get_user_rol() is not null);

drop policy if exists oc_auditoria_insert on ordenes_compra_auditoria;
create policy oc_auditoria_insert on ordenes_compra_auditoria
  for insert with check (
    usuario_id = auth.uid()
    and get_user_rol() in ('supervisor', 'compras')
  );

grant select, insert on ordenes_compra_auditoria to authenticated;

-- ===================== reabrir la OC 3758 =====================
do $$
declare
  v_orden record;
  v_actor uuid;
begin
  select id into v_actor from profiles where rol = 'supervisor' and activo order by id limit 1;

  for v_orden in
    select id, estado from ordenes_compra
    where numero_oc ~ '3758$' and estado = 'listo'
  loop
    update ordenes_compra
    set estado = 'en_curso', finalizada_at = null, updated_at = now()
    where id = v_orden.id;

    if v_actor is not null then
      insert into ordenes_compra_auditoria (orden_id, accion, motivo, detalle, usuario_id)
      values (v_orden.id, 'reabrir',
              'Se cerró por equivocación sin haber entregado el pedido (corrección pedida por el cliente)',
              jsonb_build_object('estado_anterior', v_orden.estado, 'origen', 'migración 076'),
              v_actor);
    end if;
  end loop;
end $$;

commit;

-- Para verificar: debe aparecer la 3758 en curso.
select id, numero_oc, estado, finalizada_at from ordenes_compra where numero_oc ~ '3758$';
