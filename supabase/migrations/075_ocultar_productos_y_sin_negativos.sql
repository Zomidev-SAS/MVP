-- 075: ocultar productos del inventario, umbral de stock por producto y saldos sin negativos.
--
-- 1) productos.oculto: los productos marcados NO aparecen en Inventario, Dashboard, TV ni
--    alertas. La sincronización nocturna con Siigo no toca esta marca (si Siigo vuelve a
--    traer el producto sigue oculto). Se revierte con:
--      update productos set oculto = false where codigo_producto = '...';
--    Se ocultan por nombre: escotilla inyectada renovación evo, tapa logo gris, cuchillo
--    tapicero e inversores de 400, 500, 1000 y 2000. Al final se listan los que quedaron
--    ocultos para revisarlos.
--
-- 2) productos.umbral_stock_bajo: umbral propio de un producto (manda sobre el de su
--    categoría y el general). Incaspray Forte x 53 galones queda en 0: avisa solo al llegar a 0.
--
-- 3) Sin negativos:
--    * vistas de inventario muestran saldo = max(saldo, 0);
--    * trigger: si un movimiento deja negativo el saldo de un producto en una bodega, se
--      cubre en el acto (primero con existencias de otras bodegas del mismo producto y,
--      si no alcanza, con un ajuste a 0). El ledger sigue siendo append-only: queda el
--      rastro de cada movimiento;
--    * corrección única de los saldos que hoy están en negativo (p. ej. cubre asiento
--      Sprinter 90 cm en -1).

begin;

-- ===================== 1) y 2) columnas nuevas =====================
alter table productos
  add column if not exists oculto            boolean not null default false,
  add column if not exists umbral_stock_bajo integer check (umbral_stock_bajo >= 0);

-- 073 dejó permiso por columna en productos (siigo_precio oculto): las nuevas se conceden aparte.
do $$
declare rol text;
begin
  foreach rol in array array['authenticated', 'anon'] loop
    execute format('grant select (oculto, umbral_stock_bajo) on public.productos to %I', rol);
  end loop;
end $$;

-- umbral que aplica a un producto: el propio, si no el de su categoría, si no el general.
create or replace function fn_umbral_producto(p_codigo text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.umbral_stock_bajo from productos p where p.codigo_producto = p_codigo),
    fn_umbral_stock((select p.categoria from productos p where p.codigo_producto = p_codigo))
  );
$$;

revoke all on function fn_umbral_producto(text) from public, anon;
grant execute on function fn_umbral_producto(text) to authenticated, service_role;

-- ===================== ocultar productos (por nombre, sin tildes) =====================
update productos
set oculto = true
where translate(lower(nombre_producto), 'áéíóúü', 'aeiouu') ~
      '(escotilla.*inyectada.*renovacion.*evo|tapa.*logo.*gris|cuchillo.*tapicero|\minversor\w*\s+(de\s+)?(400|500|1000|2000)(?!\d))';

-- Incaspray Forte x 53 galones: stock bajo = 0.
update productos
set umbral_stock_bajo = 0
where translate(lower(nombre_producto), 'áéíóúü', 'aeiouu') ~ 'incaspray\s+forte.*x\s*53';

-- Las alertas abiertas de productos ocultos se cierran.
update alertas_stock_bajo a
set abierta = false, cerrado_at = now()
where a.abierta
  and exists (select 1 from productos p where p.codigo_producto = a.codigo_producto and p.oculto);

-- ===================== 3) vistas: sin ocultos y sin saldos negativos =====================
do $$
declare
  t_unit_actual  text;
  t_total_actual text;
  t_unit_bodega  text;
  t_total_bodega text;
  cuerpo_costos  text := $c$
  fn_valor_unitario_producto(m.codigo_producto)::%1$s as valor_unitario,
  (case when fn_valor_unitario_producto(m.codigo_producto) is null
        then case when get_user_rol() in ('supervisor','compras','auditoria') then 0 else null end
        else greatest(sum(m.cantidad), 0) * fn_valor_unitario_producto(m.codigo_producto)
   end)::%2$s as valor_total,$c$;
begin
  select format_type(a.atttypid, a.atttypmod) into t_unit_actual
    from pg_attribute a where a.attrelid = 'public.vista_inventario_actual'::regclass and a.attname = 'valor_unitario';
  select format_type(a.atttypid, a.atttypmod) into t_total_actual
    from pg_attribute a where a.attrelid = 'public.vista_inventario_actual'::regclass and a.attname = 'valor_total';
  select format_type(a.atttypid, a.atttypmod) into t_unit_bodega
    from pg_attribute a where a.attrelid = 'public.vista_inventario_por_bodega'::regclass and a.attname = 'valor_unitario';
  select format_type(a.atttypid, a.atttypmod) into t_total_bodega
    from pg_attribute a where a.attrelid = 'public.vista_inventario_por_bodega'::regclass and a.attname = 'valor_total';

  -- Mismas columnas y orden que 073; solo se agrega umbral_stock al final de ambas vistas.
  execute format($v$
    create or replace view public.vista_inventario_actual with (security_invoker = true) as
    select
      m.codigo_producto,
      p.nombre_producto,
      p.unidad_medida,
      p.categoria,
      greatest(sum(m.cantidad), 0) as saldo,
      %s
      max(m.created_at) as ultimo_movimiento,
      fn_umbral_producto(m.codigo_producto) as umbral_stock
    from public.movimientos_inventario m
    join public.productos p on p.codigo_producto = m.codigo_producto
    where m.estado = 'aplicado' and p.categoria is not null and not p.oculto
    group by m.codigo_producto, p.nombre_producto, p.unidad_medida, p.categoria
  $v$, format(cuerpo_costos, t_unit_actual, t_total_actual));

  execute format($v$
    create or replace view public.vista_inventario_por_bodega with (security_invoker = true) as
    select
      m.codigo_producto,
      p.nombre_producto,
      p.unidad_medida,
      p.categoria,
      m.bodega,
      greatest(sum(m.cantidad), 0) as saldo,
      %s
      max(m.created_at) as ultimo_movimiento,
      fn_umbral_producto(m.codigo_producto) as umbral_stock
    from public.movimientos_inventario m
    join public.productos p on p.codigo_producto = m.codigo_producto
    where m.estado = 'aplicado' and p.categoria is not null and not p.oculto
    group by m.codigo_producto, p.nombre_producto, p.unidad_medida, p.categoria, m.bodega
  $v$, format(cuerpo_costos, t_unit_bodega, t_total_bodega));
end $$;

create or replace view public.vista_stock_bajo
with (security_invoker = true) as
select
  v.codigo_producto,
  v.nombre_producto,
  v.categoria,
  v.saldo,
  v.umbral_stock as umbral
from public.vista_inventario_actual v
where v.saldo > 0
  and v.saldo <= v.umbral_stock;

grant select on public.vista_inventario_actual, public.vista_inventario_por_bodega, public.vista_stock_bajo to authenticated;

-- ===================== alerta de stock bajo: ocultos y umbral por producto =====================
create or replace function fn_revisar_stock_bajo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo      numeric;
  v_umbral     integer;
  v_cat        text;
  v_umbral_cat integer;
  v_umbral_prod integer;
  v_oculto     boolean;
  v_alerta_id  bigint;
begin
  if NEW.estado <> 'aplicado' or NEW.bodega is null then
    return NEW;
  end if;

  select p.categoria, p.umbral_stock_bajo, p.oculto
    into v_cat, v_umbral_prod, v_oculto
    from productos p where p.codigo_producto = NEW.codigo_producto;

  -- Producto oculto: no genera alertas y cierra las que tuviera.
  if coalesce(v_oculto, false) then
    update alertas_stock_bajo set abierta = false, cerrado_at = now()
    where codigo_producto = NEW.codigo_producto and abierta = true;
    return NEW;
  end if;

  select u.umbral into v_umbral_cat from umbrales_categoria u where u.categoria = v_cat;
  v_umbral_cat := coalesce(v_umbral_prod, v_umbral_cat);

  if v_umbral_cat is not null then
    -- Umbral propio del producto o de su categoría: se vigila el saldo total.
    v_umbral := v_umbral_cat;
    select greatest(coalesce(sum(cantidad), 0), 0) into v_saldo
      from movimientos_inventario
      where codigo_producto = NEW.codigo_producto and estado = 'aplicado';

    select id into v_alerta_id
      from alertas_stock_bajo
      where codigo_producto = NEW.codigo_producto and abierta = true
      order by id limit 1;

    if v_saldo <= v_umbral then
      if v_alerta_id is null then
        insert into alertas_stock_bajo (codigo_producto, bodega, saldo_en_alerta, umbral)
        values (NEW.codigo_producto, NEW.bodega, v_saldo, v_umbral);

        perform fn_crear_notificacion(
          p_tipo => 'stock_bajo', p_titulo => 'Stock bajo',
          p_mensaje => 'El producto ' || NEW.codigo_producto || ' tiene saldo total '
                       || v_saldo || ' (mínimo ' || v_umbral || ').',
          p_enlace => '/inventario?producto=' || NEW.codigo_producto, p_rol_destino => 'supervisor');
        perform fn_crear_notificacion(
          p_tipo => 'stock_bajo', p_titulo => 'Stock bajo',
          p_mensaje => 'El producto ' || NEW.codigo_producto || ' tiene saldo total '
                       || v_saldo || ' (mínimo ' || v_umbral || ').',
          p_enlace => '/inventario?producto=' || NEW.codigo_producto, p_rol_destino => 'compras');
      else
        update alertas_stock_bajo set saldo_en_alerta = v_saldo, umbral = v_umbral
        where codigo_producto = NEW.codigo_producto and abierta = true;
      end if;
    else
      update alertas_stock_bajo set abierta = false, cerrado_at = now()
      where codigo_producto = NEW.codigo_producto and abierta = true;
    end if;
    return NEW;
  end if;

  -- Sin umbral propio: por producto + bodega con el umbral global.
  select umbral_stock_bajo into v_umbral from config_app where id = 1;
  if v_umbral is null then
    v_umbral := 2;
  end if;

  select greatest(coalesce(sum(cantidad), 0), 0)
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
      update alertas_stock_bajo set saldo_en_alerta = v_saldo where id = v_alerta_id;
    end if;
  else
    if v_alerta_id is not null then
      update alertas_stock_bajo set abierta = false, cerrado_at = now() where id = v_alerta_id;
    end if;
  end if;

  return NEW;
end;
$$;

-- ===================== 3) nunca saldo negativo =====================
-- Si el saldo de un producto en una bodega queda por debajo de 0, se cubre el faltante:
--   1. primero moviendo existencias de otras bodegas del mismo producto (par de ajustes,
--      el total del producto no cambia);
--   2. lo que aún falte se suma con un ajuste, para que el total tampoco quede negativo.
-- El ledger sigue siendo append-only: queda el rastro de cada movimiento.
create or replace function fn_cubrir_deficit_bodega(
  p_codigo text, p_bodega text, p_actor uuid, p_clave text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_falta numeric;
  v_toma  numeric;
  src     record;
begin
  select -sum(cantidad) into v_falta
  from movimientos_inventario
  where codigo_producto = p_codigo and bodega = p_bodega and estado = 'aplicado';

  if v_falta is null or v_falta <= 0 then
    return;
  end if;

  for src in
    select bodega, sum(cantidad) as saldo
    from movimientos_inventario
    where codigo_producto = p_codigo and estado = 'aplicado'
      and bodega is not null and bodega <> p_bodega
    group by bodega
    having sum(cantidad) > 0
    order by sum(cantidad) desc
  loop
    exit when v_falta <= 0;
    v_toma := least(src.saldo, v_falta);
    insert into movimientos_inventario
      (codigo_producto, tipo_movimiento, cantidad, bodega, motivo, actor_id, idempotency_key)
    values
      (p_codigo, 'ajuste', -v_toma, src.bodega,
       'Reubicación entre bodegas: la bodega ' || p_bodega || ' quedaba en negativo', p_actor,
       p_clave || '-o-' || md5(src.bodega)),
      (p_codigo, 'ajuste', v_toma, p_bodega,
       'Reubicación entre bodegas: la bodega ' || p_bodega || ' quedaba en negativo', p_actor,
       p_clave || '-d-' || md5(src.bodega));
    v_falta := v_falta - v_toma;
  end loop;

  if v_falta > 0 then
    insert into movimientos_inventario
      (codigo_producto, tipo_movimiento, cantidad, bodega, motivo, actor_id, idempotency_key)
    values
      (p_codigo, 'ajuste', v_falta, p_bodega,
       'Saldo llevado a 0: no se permiten saldos negativos', p_actor, p_clave || '-0');
  end if;
end;
$$;

revoke all on function fn_cubrir_deficit_bodega(text, text, uuid, text) from public, anon, authenticated;

-- Trigger: tras una salida que deja el saldo de esa bodega por debajo de 0.
create or replace function fn_saldo_sin_negativos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fn_cubrir_deficit_bodega(NEW.codigo_producto, NEW.bodega, NEW.actor_id,
                                   'sin-negativos-' || NEW.id);
  return NEW;
end;
$$;

revoke all on function fn_saldo_sin_negativos() from public, anon, authenticated;

drop trigger if exists trg_saldo_sin_negativos on movimientos_inventario;
create trigger trg_saldo_sin_negativos
  after insert on movimientos_inventario
  for each row
  when (NEW.estado = 'aplicado' and NEW.cantidad < 0 and NEW.bodega is not null)
  execute function fn_saldo_sin_negativos();

-- Corrección única: lo que hoy está en negativo (producto + bodega) se lleva a 0.
create or replace function fn_corregir_saldos_negativos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  neg     record;
  v_actor uuid;
  v_n     int := 0;
  v_hoy   text := to_char(now() at time zone 'America/Bogota', 'YYYYMMDD');
begin
  select actor_id into v_actor from movimientos_inventario
   where motivo like 'Sincronización con Siigo%' limit 1;
  if v_actor is null then
    select id into v_actor from profiles where rol = 'supervisor' and activo order by id limit 1;
  end if;
  if v_actor is null then
    return 0;
  end if;

  for neg in
    select codigo_producto, bodega
    from movimientos_inventario
    where estado = 'aplicado' and bodega is not null
    group by codigo_producto, bodega
    having sum(cantidad) < 0
  loop
    perform fn_cubrir_deficit_bodega(neg.codigo_producto, neg.bodega, v_actor,
      'sin-negativos-' || v_hoy || '-' || md5(neg.codigo_producto || neg.bodega || clock_timestamp()::text));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function fn_corregir_saldos_negativos() from public, anon, authenticated;
grant execute on function fn_corregir_saldos_negativos() to service_role;

select fn_corregir_saldos_negativos() as bodegas_negativas_corregidas;

commit;

-- ===================== resultado para revisar =====================
select 'oculto' as accion, codigo_producto, nombre_producto from productos where oculto
union all
select 'umbral 0', codigo_producto, nombre_producto from productos where umbral_stock_bajo = 0
order by 1, 3;
