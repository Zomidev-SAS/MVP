-- B4: Alerta de stock bajo sin duplicados.
-- Tras cada movimiento aplicado, compara el saldo (producto + bodega) contra
-- config_app.umbral_stock_bajo. Mantiene como mucho UNA alerta activa por
-- producto+bodega (el índice único parcial de abajo lo garantiza a nivel de
-- base de datos, no solo por lógica de aplicación) y la cierra sola cuando el
-- saldo vuelve a superar el umbral.

create table if not exists alertas_stock_bajo (
  id               bigint generated always as identity primary key,
  codigo_producto  text not null references productos(codigo_producto),
  bodega           text not null references bodegas(nombre),
  saldo_en_alerta  numeric not null,
  umbral           integer not null,
  abierta          boolean not null default true,
  creado_at        timestamptz not null default now(),
  cerrado_at       timestamptz
);

-- Garantiza una sola alerta ABIERTA por producto+bodega (a nivel de BD, no solo de código).
create unique index if not exists uq_alerta_stock_bajo_activa
  on alertas_stock_bajo (codigo_producto, bodega)
  where abierta = true;

create index if not exists idx_alertas_stock_bajo_abiertas
  on alertas_stock_bajo (abierta) where abierta = true;

alter table alertas_stock_bajo enable row level security;

drop policy if exists alertas_stock_bajo_select on alertas_stock_bajo;
create policy alertas_stock_bajo_select on alertas_stock_bajo
  for select using (get_user_rol() in ('supervisor', 'compras', 'auditoria'));

grant select on alertas_stock_bajo to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'alertas_stock_bajo'
  ) then
    alter publication supabase_realtime add table alertas_stock_bajo;
  end if;
end $$;

-- ===================== Trigger =====================
create or replace function fn_revisar_stock_bajo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo  numeric;
  v_umbral integer;
  v_alerta_id bigint;
begin
  -- Solo nos importan movimientos aplicados con bodega conocida.
  if NEW.estado <> 'aplicado' or NEW.bodega is null then
    return NEW;
  end if;

  select umbral_stock_bajo into v_umbral from config_app where id = 1;
  if v_umbral is null then
    v_umbral := 2; -- valor por defecto si config_app no tiene fila (no debería pasar)
  end if;

  select coalesce(sum(cantidad), 0)
    into v_saldo
    from movimientos_inventario
    where codigo_producto = NEW.codigo_producto
      and bodega = NEW.bodega
      and estado = 'aplicado';

  select id into v_alerta_id
    from alertas_stock_bajo
    where codigo_producto = NEW.codigo_producto
      and bodega = NEW.bodega
      and abierta = true;

  if v_saldo <= v_umbral then
    if v_alerta_id is null then
      -- Nueva alerta: se crea y se notifica una sola vez.
      insert into alertas_stock_bajo (codigo_producto, bodega, saldo_en_alerta, umbral)
      values (NEW.codigo_producto, NEW.bodega, v_saldo, v_umbral);

      perform fn_crear_notificacion(
        p_tipo        => 'stock_bajo',
        p_titulo      => 'Stock bajo',
        p_mensaje     => 'El producto ' || NEW.codigo_producto || ' en ' || NEW.bodega ||
                          ' tiene saldo ' || v_saldo || ' (umbral ' || v_umbral || ').',
        p_enlace      => '/inventario?producto=' || NEW.codigo_producto || '&bodega=' || NEW.bodega,
        p_rol_destino => 'supervisor'
      );
      perform fn_crear_notificacion(
        p_tipo        => 'stock_bajo',
        p_titulo      => 'Stock bajo',
        p_mensaje     => 'El producto ' || NEW.codigo_producto || ' en ' || NEW.bodega ||
                          ' tiene saldo ' || v_saldo || ' (umbral ' || v_umbral || ').',
        p_enlace      => '/inventario?producto=' || NEW.codigo_producto || '&bodega=' || NEW.bodega,
        p_rol_destino => 'compras'
      );
    else
      -- Ya había alerta abierta: solo actualizamos el saldo visible, sin re-notificar.
      update alertas_stock_bajo
      set saldo_en_alerta = v_saldo
      where id = v_alerta_id;
    end if;
  else
    -- El saldo se recuperó: cerramos la alerta sola si había una abierta.
    if v_alerta_id is not null then
      update alertas_stock_bajo
      set abierta = false, cerrado_at = now()
      where id = v_alerta_id;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_revisar_stock_bajo on movimientos_inventario;
create trigger trg_revisar_stock_bajo
  after insert on movimientos_inventario
  for each row execute function fn_revisar_stock_bajo();
