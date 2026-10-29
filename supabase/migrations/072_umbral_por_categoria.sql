-- 072: umbral de stock mínimo por categoría.
--
-- El umbral de config_app (global) sigue siendo el valor por defecto. Cada
-- categoría puede tener el suyo: p. ej. TORNILLERIA avisa cuando el saldo llega
-- o baja de 100. Una categoría sin umbral propio usa el global.
--
--   * umbrales_categoria          -> un umbral por categoría (solo el supervisor lo edita)
--   * fn_umbral_stock(categoria)  -> umbral que aplica a una categoría
--   * vista_stock_bajo            -> productos con saldo > 0 y <= su umbral (total, todas las bodegas)
--   * alerta/notificación de stock bajo (034) y TV de planta (048) usan ese umbral
--
-- Productos con categoría que tienen umbral propio se vigilan por el saldo TOTAL
-- (todas las bodegas); el resto sigue como antes (por producto + bodega).

create table if not exists umbrales_categoria (
  categoria  text primary key references categorias_inventario(nombre) on update cascade on delete cascade,
  umbral     integer not null check (umbral >= 0),
  updated_at timestamptz not null default now()
);

alter table umbrales_categoria enable row level security;

drop policy if exists umbrales_categoria_select on umbrales_categoria;
create policy umbrales_categoria_select on umbrales_categoria
  for select using (get_user_rol() is not null);

drop policy if exists umbrales_categoria_insert on umbrales_categoria;
create policy umbrales_categoria_insert on umbrales_categoria
  for insert with check (get_user_rol() = 'supervisor');

drop policy if exists umbrales_categoria_update on umbrales_categoria;
create policy umbrales_categoria_update on umbrales_categoria
  for update using (get_user_rol() = 'supervisor') with check (get_user_rol() = 'supervisor');

drop policy if exists umbrales_categoria_delete on umbrales_categoria;
create policy umbrales_categoria_delete on umbrales_categoria
  for delete using (get_user_rol() = 'supervisor');

grant select, insert, update, delete on umbrales_categoria to authenticated;

-- Tornillería: alerta de mínimo en 100.
insert into umbrales_categoria (categoria, umbral)
select 'TORNILLERIA', 100
where exists (select 1 from categorias_inventario where nombre = 'TORNILLERIA')
on conflict (categoria) do nothing;

create or replace function fn_umbral_stock(p_categoria text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.umbral from umbrales_categoria u where u.categoria = p_categoria),
    (select c.umbral_stock_bajo from config_app c where c.id = 1),
    2
  );
$$;

revoke all on function fn_umbral_stock(text) from public, anon;
grant execute on function fn_umbral_stock(text) to authenticated, service_role;

-- Productos con stock bajo según el umbral de su categoría (saldo total).
create or replace view vista_stock_bajo as
select
  v.codigo_producto,
  v.nombre_producto,
  v.categoria,
  v.saldo,
  fn_umbral_stock(v.categoria) as umbral
from vista_inventario_actual v
where v.saldo > 0
  and v.saldo <= fn_umbral_stock(v.categoria);

grant select on vista_stock_bajo to authenticated;

-- ===================== alerta de stock bajo (034) =====================
create or replace function fn_revisar_stock_bajo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo     numeric;
  v_umbral    integer;
  v_cat       text;
  v_umbral_cat integer;
  v_alerta_id bigint;
begin
  if NEW.estado <> 'aplicado' or NEW.bodega is null then
    return NEW;
  end if;

  select p.categoria into v_cat from productos p where p.codigo_producto = NEW.codigo_producto;
  select u.umbral into v_umbral_cat from umbrales_categoria u where u.categoria = v_cat;

  if v_umbral_cat is not null then
    -- Categoría con umbral propio: se vigila el saldo total del producto.
    v_umbral := v_umbral_cat;
    select coalesce(sum(cantidad), 0) into v_saldo
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
          p_mensaje => 'El producto ' || NEW.codigo_producto || ' (' || v_cat || ') tiene saldo total '
                       || v_saldo || ' (mínimo de la categoría ' || v_umbral || ').',
          p_enlace => '/inventario?producto=' || NEW.codigo_producto, p_rol_destino => 'supervisor');
        perform fn_crear_notificacion(
          p_tipo => 'stock_bajo', p_titulo => 'Stock bajo',
          p_mensaje => 'El producto ' || NEW.codigo_producto || ' (' || v_cat || ') tiene saldo total '
                       || v_saldo || ' (mínimo de la categoría ' || v_umbral || ').',
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

  -- Sin umbral propio: comportamiento anterior (por producto + bodega, umbral global).
  select umbral_stock_bajo into v_umbral from config_app where id = 1;
  if v_umbral is null then
    v_umbral := 2;
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

-- ===================== TV de planta (048): stock bajo por categoría =====================
create or replace function rpc_datos_planta(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoy       date := (now() at time zone 'America/Bogota')::date;
  v_resultado jsonb;
begin
  if not fn_verificar_token_planta(p_token) then
    raise exception 'Token de planta inválido o vencido' using errcode = '28000';
  end if;


  select jsonb_build_object(
    'vehiculos_por_etapa', coalesce((
      select jsonb_agg(jsonb_build_object('etapa', etapa, 'cantidad', vehiculos) order by vehiculos desc)
      from (
        select proceso_estado as etapa, count(*) as vehiculos
        from (
          select distinct on (chasis) chasis, proceso_estado
          from vehiculo_procesos
          order by chasis, creado_en desc
        ) ultimos
        group by proceso_estado
      ) etapas
    ), '[]'::jsonb),

    -- Mismo criterio que getDashboardData: últimos 7 días en hora de Bogotá,
    -- contando movimientos aplicados (no unidades).
    'entradas_salidas', (
      select jsonb_agg(jsonb_build_object(
               'fecha', to_char(d.dia, 'YYYY-MM-DD'),
               'entradas', coalesce(m.entradas, 0),
               'salidas', coalesce(m.salidas, 0)
             ) order by d.dia)
      from generate_series(v_hoy - 6, v_hoy, interval '1 day') as d(dia)
      left join (
        select (created_at at time zone 'America/Bogota')::date as dia,
               count(*) filter (where tipo_movimiento = 'entrada')    as entradas,
               count(*) filter (where tipo_movimiento = 'salida_vin') as salidas
        from movimientos_inventario
        where estado = 'aplicado'
          and tipo_movimiento in ('entrada', 'salida_vin')
          and created_at >= ((v_hoy - 6)::timestamp at time zone 'America/Bogota')
        group by 1
      ) m on m.dia = d.dia::date
    ),

    'productos_stock_bajo', coalesce((
      select jsonb_agg(jsonb_build_object(
               'codigo_producto', codigo_producto,
               'nombre_producto', nombre_producto,
               'saldo', saldo
             ) order by saldo, codigo_producto)
      from (
        select codigo_producto, nombre_producto, saldo
        from vista_stock_bajo
        order by saldo, codigo_producto
        limit 10
      ) bajos
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function rpc_datos_planta(text) from public;
grant execute on function rpc_datos_planta(text) to anon, authenticated, service_role;
