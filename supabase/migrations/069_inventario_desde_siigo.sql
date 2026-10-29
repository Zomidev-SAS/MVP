-- 069: el inventario del panel se alinea con Siigo todas las noches.
--
-- La bajada nocturna (063, 12 a. m. Colombia) ahora recorre TODO el catálogo de
-- Siigo y, por cada producto que existe en el panel:
--   * nombre y unidad de medida  -> se actualizan en `productos`
--   * precio unitario            -> productos.siigo_precio (la vista lo muestra
--                                   como valor_unitario en lugar del máximo histórico)
--   * unidades                   -> si el saldo del panel difiere de la existencia
--                                   de Siigo se registra un movimiento de 'ajuste'
--                                   por la diferencia (queda historial; los
--                                   movimientos nunca se editan ni se borran)
-- Los productos activos de Siigo que no existen en el panel se agregan.
--
-- Solo se tocan productos con control de inventario en Siigo (stock_control).

alter table productos
  add column if not exists siigo_precio     numeric(14,2),
  add column if not exists siigo_existencia numeric(14,2),
  add column if not exists siigo_marca      text,
  add column if not exists siigo_sync_at    timestamptz;

-- ===================== vistas: precio unitario de Siigo =====================
-- Mismas columnas y orden que 011 / 020; solo cambia valor_unitario/valor_total.
create or replace view vista_inventario_actual as
select
  m.codigo_producto,
  p.nombre_producto,
  p.unidad_medida,
  p.categoria,
  sum(m.cantidad) as saldo,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then coalesce(p.siigo_precio, max(m.valor_unitario))
       else null
  end as valor_unitario,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then sum(m.cantidad) * coalesce(p.siigo_precio, max(coalesce(m.valor_unitario, 0)))
       else null
  end as valor_total,
  max(m.created_at) as ultimo_movimiento
from movimientos_inventario m
join productos p on p.codigo_producto = m.codigo_producto
where m.estado = 'aplicado'
group by m.codigo_producto, p.nombre_producto, p.unidad_medida, p.categoria, p.siigo_precio;

create or replace view vista_inventario_por_bodega as
select
  m.codigo_producto,
  p.nombre_producto,
  p.unidad_medida,
  p.categoria,
  m.bodega,
  sum(m.cantidad) as saldo,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then coalesce(p.siigo_precio, max(m.valor_unitario))
       else null
  end as valor_unitario,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then sum(m.cantidad) * coalesce(p.siigo_precio, max(coalesce(m.valor_unitario, 0)))
       else null
  end as valor_total,
  max(m.created_at) as ultimo_movimiento
from movimientos_inventario m
join productos p on p.codigo_producto = m.codigo_producto
where m.estado = 'aplicado'
group by m.codigo_producto, p.nombre_producto, p.unidad_medida, p.categoria, m.bodega, p.siigo_precio;

-- Reparte un ajuste entre bodegas para que ninguna quede en negativo:
--   delta < 0: descuenta de las bodegas que tienen saldo (la de más saldo primero);
--              solo lo que no alcance queda en 'Sin Asignar' (Siigo con existencia negativa).
--   delta > 0: suma en la bodega con más saldo ('Sin Asignar' si no hay ninguna).
-- Los movimientos son append-only: sin ON CONFLICT (la tabla tiene reglas).
create or replace function fn_repartir_ajuste_siigo(
  p_codigo text, p_delta numeric, p_precio numeric, p_motivo text, p_actor uuid, p_hoy text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r        record;
  v_resto  numeric;
  v_toma   numeric;
  v_bodega text;
begin
  if p_delta < 0 then
    v_resto := -p_delta;
    for r in
      select bodega, sum(cantidad) as saldo
      from movimientos_inventario
      where codigo_producto = p_codigo and estado = 'aplicado'
      group by bodega
      having sum(cantidad) > 0
      order by sum(cantidad) desc
    loop
      exit when v_resto <= 0;
      v_toma := least(r.saldo, v_resto);
      insert into movimientos_inventario (codigo_producto, tipo_movimiento, cantidad, valor_unitario,
                                          bodega, motivo, actor_id, idempotency_key)
      values (p_codigo, 'ajuste', -v_toma, p_precio, r.bodega, p_motivo, p_actor,
              'siigo-sync-' || p_hoy || '-' || p_codigo || '-' || md5(r.bodega || clock_timestamp()::text));
      v_resto := v_resto - v_toma;
    end loop;
    if v_resto > 0 then
      insert into movimientos_inventario (codigo_producto, tipo_movimiento, cantidad, valor_unitario,
                                          bodega, motivo, actor_id, idempotency_key)
      values (p_codigo, 'ajuste', -v_resto, p_precio, 'Sin Asignar', p_motivo, p_actor,
              'siigo-sync-' || p_hoy || '-' || p_codigo || '-' || md5('sa' || clock_timestamp()::text));
    end if;
  elsif p_delta > 0 then
    select bodega into v_bodega
    from movimientos_inventario
    where codigo_producto = p_codigo and estado = 'aplicado'
    group by bodega
    having sum(cantidad) > 0
    order by sum(cantidad) desc
    limit 1;
    insert into movimientos_inventario (codigo_producto, tipo_movimiento, cantidad, valor_unitario,
                                        bodega, motivo, actor_id, idempotency_key)
    values (p_codigo, 'ajuste', p_delta, p_precio, coalesce(v_bodega, 'Sin Asignar'), p_motivo, p_actor,
            'siigo-sync-' || p_hoy || '-' || p_codigo || '-' || md5('mas' || clock_timestamp()::text));
  end if;
end;
$$;

revoke all on function fn_repartir_ajuste_siigo(text, numeric, numeric, text, uuid, text) from public, anon, authenticated;

-- ===================== aplicar lo que baja de Siigo =====================
-- p_items: [{codigo, nombre, unidad, precio, existencia, control_inventario, activo, marca}]
-- p_dry: solo cuenta, no escribe nada.
-- Devuelve {actualizados, nuevos, ajustes, unidades_ajustadas}.
create or replace function fn_aplicar_inventario_siigo(
  p_items jsonb,
  p_actor uuid,
  p_dry   boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  it          jsonb;
  v_codigo    text;
  v_nombre    text;
  v_unidad    text;
  v_precio    numeric;
  v_exist     numeric;
  v_control   boolean;
  v_activo    boolean;
  v_marca     text;
  v_existe    boolean;
  v_saldo     numeric;
  v_delta     numeric;
  v_hoy       text := to_char((now() at time zone 'America/Bogota')::date, 'YYYY-MM-DD');
  v_nuevos    int := 0;
  v_actualiz  int := 0;
  v_ajustes   int := 0;
  v_unidades  numeric := 0;
  v_muestra   jsonb := '[]'::jsonb;
  v_muestra_n jsonb := '[]'::jsonb;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_codigo  := btrim(it ->> 'codigo');
    if v_codigo is null or v_codigo = '' then
      continue;
    end if;
    v_nombre  := nullif(btrim(it ->> 'nombre'), '');
    v_unidad  := nullif(btrim(it ->> 'unidad'), '');
    v_precio  := nullif(it ->> 'precio', '')::numeric;
    v_exist   := nullif(it ->> 'existencia', '')::numeric;
    v_control := coalesce((it ->> 'control_inventario')::boolean, false);
    v_activo  := coalesce((it ->> 'activo')::boolean, true);
    v_marca   := nullif(btrim(it ->> 'marca'), '');

    select exists (select 1 from productos where codigo_producto = v_codigo) into v_existe;

    if not v_existe then
      -- Solo se agregan productos activos y con nombre.
      if v_activo and v_nombre is not null then
        v_nuevos := v_nuevos + 1;
        v_muestra_n := v_muestra_n || jsonb_build_object('codigo', v_codigo, 'nombre', v_nombre);
        if not p_dry then
          insert into productos (codigo_producto, nombre_producto, unidad_medida,
                                 siigo_precio, siigo_existencia, siigo_marca, siigo_sync_at)
          values (v_codigo, v_nombre, v_unidad, v_precio, v_exist, v_marca, now())
          on conflict (codigo_producto) do nothing;
        end if;
      else
        continue;
      end if;
    else
      -- Cuenta como actualizado si algo visible cambia.
      if exists (
        select 1 from productos p
        where p.codigo_producto = v_codigo
          and (
            (v_nombre is not null and p.nombre_producto is distinct from v_nombre)
            or (v_unidad is not null and p.unidad_medida is distinct from v_unidad)
            or (v_precio is not null and p.siigo_precio is distinct from v_precio)
          )
      ) then
        v_actualiz := v_actualiz + 1;
      end if;

      if not p_dry then
        update productos
        set nombre_producto  = coalesce(v_nombre, nombre_producto),
            unidad_medida    = coalesce(v_unidad, unidad_medida),
            siigo_precio     = coalesce(v_precio, siigo_precio),
            siigo_existencia = v_exist,
            siigo_marca      = coalesce(v_marca, siigo_marca),
            siigo_sync_at    = now()
        where codigo_producto = v_codigo;
      end if;
    end if;

    -- Unidades: el saldo del panel debe igualar la existencia de Siigo.
    if v_control and v_exist is not null and v_activo then
      select coalesce(sum(cantidad), 0) into v_saldo
      from movimientos_inventario
      where codigo_producto = v_codigo and estado = 'aplicado';

      v_delta := round(v_exist - v_saldo, 2);
      if v_delta <> 0 then
        v_ajustes  := v_ajustes + 1;
        v_unidades := v_unidades + abs(v_delta);
        v_muestra  := v_muestra || jsonb_build_object(
          'codigo', v_codigo, 'nombre', v_nombre, 'panel', v_saldo, 'siigo', v_exist, 'unidad', v_unidad);
        if not p_dry then
          perform fn_repartir_ajuste_siigo(v_codigo, v_delta, v_precio,
            'Sincronización con Siigo (existencia ' || v_exist || ', panel ' || v_saldo || ')',
            p_actor, v_hoy);
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'actualizados', v_actualiz,
    'nuevos', v_nuevos,
    'ajustes', v_ajustes,
    'unidades_ajustadas', v_unidades,
    'muestra_ajustes', (
      select coalesce(jsonb_agg(e), '[]'::jsonb) from (
        select e from jsonb_array_elements(v_muestra) e
        order by abs((e ->> 'siigo')::numeric - (e ->> 'panel')::numeric) desc limit 8) t),
    'muestra_nuevos', (
      select coalesce(jsonb_agg(e), '[]'::jsonb) from (
        select e from jsonb_array_elements(v_muestra_n) e limit 8) t)
  );
end;
$$;

revoke all on function fn_aplicar_inventario_siigo(jsonb, uuid, boolean) from public, anon, authenticated;
grant execute on function fn_aplicar_inventario_siigo(jsonb, uuid, boolean) to service_role;
