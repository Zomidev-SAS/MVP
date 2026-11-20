-- 073: las vistas de inventario dejan de ser "Security Definer View" (alerta CRÍTICA
-- del linter de Supabase) sin perder el ocultamiento de costos.
--
-- Antes (011/012): las vistas corrían con permisos del DUEÑO para poder leer
-- movimientos_inventario.valor_unitario (columna revocada a 'authenticated') y
-- enmascararla con CASE get_user_rol(). Eso es justo lo que el linter marca.
--
-- Ahora:
--   * fn_valor_unitario_producto(codigo): función SECURITY DEFINER que devuelve el
--     precio unitario SOLO a supervisor, compras y auditoría (el resto recibe NULL).
--     Usa el precio de Siigo si es válido y, si no, el mayor precio positivo de los
--     movimientos aplicados (igual que 071).
--   * vista_inventario_actual, vista_inventario_por_bodega y vista_stock_bajo pasan a
--     security_invoker = true: leen con los permisos y la RLS de quien consulta
--     (get_user_rol() is not null, ya vigente en movimientos_inventario y productos).
--     Ya no tocan valor_unitario ni siigo_precio directamente.
--   * productos.siigo_precio (069) quedaba legible para cualquier usuario por consulta
--     directa a la tabla: se revoca esa columna a anon/authenticated (permiso por columna).
--
-- Cambio de comportamiento: en la vista por bodega el valor unitario ahora es el del
-- producto (antes era el mayor precio de los movimientos de esa bodega).

begin;

-- ===================== 1) función de costo =====================
create or replace function fn_valor_unitario_producto(p_codigo text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when get_user_rol() in ('supervisor', 'compras', 'auditoria') then
      coalesce(
        (select p.siigo_precio from productos p
          where p.codigo_producto = p_codigo and p.siigo_precio >= 0),
        (select max(m.valor_unitario) from movimientos_inventario m
          where m.codigo_producto = p_codigo and m.estado = 'aplicado' and m.valor_unitario >= 0)
      )
    else null
  end;
$$;

revoke all on function fn_valor_unitario_producto(text) from public, anon;
grant execute on function fn_valor_unitario_producto(text) to authenticated, service_role;

-- ===================== 2) ocultar siigo_precio en consultas directas =====================
-- Un REVOKE de columna no sirve si hay GRANT a nivel de tabla: se quita el permiso de
-- tabla y se concede columna por columna, excepto siigo_precio.
do $$
declare
  rol  text;
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'productos' and column_name <> 'siigo_precio';

  foreach rol in array array['authenticated', 'anon'] loop
    if has_table_privilege(rol, 'public.productos', 'select') then
      execute format('revoke select on public.productos from %I', rol);
      execute format('grant select (%s) on public.productos to %I', cols, rol);
    end if;
  end loop;
end $$;

-- ===================== 3) vistas con security_invoker =====================
-- create or replace view no permite cambiar el tipo de una columna: se lee el tipo que
-- tiene hoy cada columna de costo (numeric o numeric(14,2), según cómo quedó la vista)
-- y se conserva.
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

  execute format($v$
    create or replace view public.vista_inventario_actual with (security_invoker = true) as
    select
      m.codigo_producto,
      p.nombre_producto,
      p.unidad_medida,
      p.categoria,
      sum(m.cantidad) as saldo,
      %s
      max(m.created_at) as ultimo_movimiento
    from public.movimientos_inventario m
    join public.productos p on p.codigo_producto = m.codigo_producto
    where m.estado = 'aplicado' and p.categoria is not null
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
      sum(m.cantidad) as saldo,
      %s
      max(m.created_at) as ultimo_movimiento
    from public.movimientos_inventario m
    join public.productos p on p.codigo_producto = m.codigo_producto
    where m.estado = 'aplicado' and p.categoria is not null
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
  fn_umbral_stock(v.categoria) as umbral
from public.vista_inventario_actual v
where v.saldo > 0
  and v.saldo <= fn_umbral_stock(v.categoria);

-- create or replace conserva los GRANT, pero se deja explícito.
grant select on public.vista_inventario_actual, public.vista_inventario_por_bodega, public.vista_stock_bajo to authenticated;

commit;
