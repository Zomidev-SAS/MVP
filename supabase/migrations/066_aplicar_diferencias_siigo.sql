-- 066: aplicar (corregir) las diferencias del catálogo de Siigo desde el panel.
--
-- Antes la lista de diferencias solo permitía "marcar revisado". Ahora lo que
-- baja de Siigo se puede llevar al panel con un clic (o en bloque):
--   producto / existencia -> agrega el producto al catálogo del panel
--   producto / nombre     -> deja el nombre de Siigo en el panel
--   proveedor / nombre    -> deja el nombre de Siigo en las OC del proveedor
-- Además existe "ignorar" (marcar revisadas) en bloque.
--
-- Las diferencias de existencia guardaban un texto fijo en vez del nombre del
-- producto: se borran las pendientes de ese formato y la bajada las vuelve a
-- crear con el nombre.

delete from siigo_catalogo_diferencias
where revisado = false
  and campo = 'existencia'
  and (valor_siigo is null or valor_siigo like 'existe en Siigo%');

-- Aplica UNA diferencia. Uso interno de los RPC de abajo.
create or replace function fn_aplicar_diferencia_siigo(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  d siigo_catalogo_diferencias%rowtype;
begin
  select * into d from siigo_catalogo_diferencias where id = p_id and revisado = false for update;
  if not found then
    return false;
  end if;

  if d.tipo = 'producto' and d.campo = 'existencia' then
    if d.valor_siigo is null or btrim(d.valor_siigo) = '' then
      return false;
    end if;
    insert into productos (codigo_producto, nombre_producto)
    values (d.codigo, btrim(d.valor_siigo))
    on conflict (codigo_producto) do nothing;

  elsif d.tipo = 'producto' and d.campo = 'nombre' then
    if d.valor_siigo is null or btrim(d.valor_siigo) = '' then
      return false;
    end if;
    update productos set nombre_producto = btrim(d.valor_siigo) where codigo_producto = d.codigo;

  elsif d.tipo = 'proveedor' and d.campo = 'nombre' then
    if d.valor_siigo is null or btrim(d.valor_siigo) = '' then
      return false;
    end if;
    update orden_compra_items set proveedor_nombre = btrim(d.valor_siigo) where proveedor_nit = d.codigo;
    update ordenes_compra set proveedor_nombre = btrim(d.valor_siigo) where proveedor_nit = d.codigo;

  else
    return false;
  end if;

  update siigo_catalogo_diferencias set revisado = true where id = p_id;
  return true;
end;
$$;

revoke all on function fn_aplicar_diferencia_siigo(bigint) from public, anon, authenticated;
grant execute on function fn_aplicar_diferencia_siigo(bigint) to service_role;

create or replace function rpc_aplicar_diferencia_siigo(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(get_user_rol(), '') not in ('supervisor', 'compras') then
    raise exception 'Sin permiso para aplicar diferencias de catálogo Siigo';
  end if;

  if not fn_aplicar_diferencia_siigo(p_id) then
    raise exception 'La diferencia % no se pudo aplicar (ya estaba revisada o no tiene datos de Siigo)', p_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function rpc_aplicar_diferencias_siigo(p_tipo text, p_campo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        bigint;
  v_aplicadas integer := 0;
  v_omitidas  integer := 0;
begin
  if coalesce(get_user_rol(), '') not in ('supervisor', 'compras') then
    raise exception 'Sin permiso para aplicar diferencias de catálogo Siigo';
  end if;

  for v_id in
    select id from siigo_catalogo_diferencias
    where revisado = false and tipo = p_tipo and campo = p_campo
    order by id
  loop
    if fn_aplicar_diferencia_siigo(v_id) then
      v_aplicadas := v_aplicadas + 1;
    else
      v_omitidas := v_omitidas + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'aplicadas', v_aplicadas, 'omitidas', v_omitidas);
end;
$$;

-- Ignorar en bloque (sin tocar el panel).
create or replace function rpc_marcar_diferencias_siigo_revisadas(p_tipo text, p_campo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if coalesce(get_user_rol(), '') not in ('supervisor', 'compras') then
    raise exception 'Sin permiso para revisar diferencias de catálogo Siigo';
  end if;

  update siigo_catalogo_diferencias
  set revisado = true
  where revisado = false and tipo = p_tipo and campo = p_campo;
  get diagnostics v_n = row_count;

  return jsonb_build_object('ok', true, 'revisadas', v_n);
end;
$$;

revoke all on function rpc_aplicar_diferencia_siigo(bigint) from public, anon;
revoke all on function rpc_aplicar_diferencias_siigo(text, text) from public, anon;
revoke all on function rpc_marcar_diferencias_siigo_revisadas(text, text) from public, anon;
grant execute on function rpc_aplicar_diferencia_siigo(bigint) to authenticated;
grant execute on function rpc_aplicar_diferencias_siigo(text, text) to authenticated;
grant execute on function rpc_marcar_diferencias_siigo_revisadas(text, text) to authenticated;
