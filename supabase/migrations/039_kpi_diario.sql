-- B5 (preparación): columnas Siigo en ordenes_compra (se usan desde ya en el
-- cierre diario y en las vistas del dashboard; B12 es quien las llena al
-- sincronizar) y la tabla kpi_diario que alimenta el dashboard (B6) y el
-- reporte semanal (B14).

alter table ordenes_compra
  add column if not exists siigo_id text,
  add column if not exists siigo_estado text
    default 'pendiente'
    check (siigo_estado in ('pendiente', 'enviando', 'sincronizada', 'error'));

create index if not exists idx_ordenes_compra_siigo_estado on ordenes_compra(siigo_estado);

create table if not exists kpi_diario (
  fecha                    date primary key,
  unidades_entrada         numeric not null default 0,
  valor_entrada            numeric not null default 0,
  unidades_salida          numeric not null default 0,
  valor_salida             numeric not null default 0,
  alertas_stock_bajo       integer not null default 0,
  ajustes_creados          integer not null default 0,
  ajustes_resueltos        integer not null default 0,
  oc_creadas               integer not null default 0,
  oc_abiertas              integer not null default 0,
  oc_vencidas              integer not null default 0,
  oc_sincronizadas_siigo   integer not null default 0,
  vehiculos_por_etapa      jsonb not null default '{}',
  generado_at              timestamptz not null default now()
);

alter table kpi_diario enable row level security;

drop policy if exists kpi_diario_select on kpi_diario;
create policy kpi_diario_select on kpi_diario
  for select using (get_user_rol() is not null);

grant select on kpi_diario to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'kpi_diario'
  ) then
    alter publication supabase_realtime add table kpi_diario;
  end if;
end $$;

-- ===================== Cierre diario (11:55 p.m., vía pg_cron en 040) =====================
create or replace function fn_cierre_diario_kpi(p_fecha date default current_date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unidades_entrada numeric;
  v_valor_entrada    numeric;
  v_unidades_salida  numeric;
  v_valor_salida     numeric;
  v_alertas          integer;
  v_ajustes_creados  integer;
  v_ajustes_resueltos integer;
  v_oc_creadas       integer;
  v_oc_abiertas      integer;
  v_oc_vencidas      integer;
  v_oc_siigo         integer;
  v_etapas           jsonb;
  v_log_id           bigint;
begin
  v_log_id := fn_log_automatizacion_iniciar('cierre_diario_kpi', jsonb_build_object('fecha', p_fecha));

  select coalesce(sum(cantidad), 0), coalesce(sum(cantidad * coalesce(valor_unitario,0)), 0)
    into v_unidades_entrada, v_valor_entrada
    from movimientos_inventario
    where estado = 'aplicado' and tipo_movimiento = 'entrada'
      and created_at::date = p_fecha;

  select coalesce(sum(abs(cantidad)), 0), coalesce(sum(abs(cantidad) * coalesce(valor_unitario,0)), 0)
    into v_unidades_salida, v_valor_salida
    from movimientos_inventario
    where estado = 'aplicado' and tipo_movimiento = 'salida_vin'
      and created_at::date = p_fecha;

  select count(*) into v_alertas from alertas_stock_bajo where abierta = true;

  select count(*) into v_ajustes_creados
    from ajustes_pendientes where created_at::date = p_fecha;
  select count(*) into v_ajustes_resueltos
    from ajustes_pendientes where resuelto_at::date = p_fecha;

  select count(*) into v_oc_creadas from ordenes_compra where created_at::date = p_fecha;
  select count(*) into v_oc_abiertas from ordenes_compra where estado = 'en_curso';
  select count(*) into v_oc_vencidas
    from ordenes_compra
    where estado not in ('listo', 'cancelada')
      and fecha_vencimiento is not null and fecha_vencimiento < current_date;
  select count(*) into v_oc_siigo from ordenes_compra where siigo_estado = 'sincronizada';

  -- Etapa actual por vehículo = la última fila de vehiculo_procesos por chasis;
  -- se cuenta cuántos vehículos están en cada etapa en este momento.
  select coalesce(jsonb_object_agg(proceso_estado, cnt), '{}'::jsonb) into v_etapas
  from (
    select proceso_estado, count(*) as cnt
    from (
      select distinct on (chasis) chasis, proceso_estado
      from vehiculo_procesos
      order by chasis, creado_en desc
    ) ultimos
    group by proceso_estado
  ) agg;

  insert into kpi_diario (
    fecha, unidades_entrada, valor_entrada, unidades_salida, valor_salida,
    alertas_stock_bajo, ajustes_creados, ajustes_resueltos,
    oc_creadas, oc_abiertas, oc_vencidas, oc_sincronizadas_siigo,
    vehiculos_por_etapa, generado_at
  ) values (
    p_fecha, v_unidades_entrada, v_valor_entrada, v_unidades_salida, v_valor_salida,
    v_alertas, v_ajustes_creados, v_ajustes_resueltos,
    v_oc_creadas, v_oc_abiertas, v_oc_vencidas, v_oc_siigo,
    v_etapas, now()
  )
  on conflict (fecha) do update set
    unidades_entrada = excluded.unidades_entrada,
    valor_entrada = excluded.valor_entrada,
    unidades_salida = excluded.unidades_salida,
    valor_salida = excluded.valor_salida,
    alertas_stock_bajo = excluded.alertas_stock_bajo,
    ajustes_creados = excluded.ajustes_creados,
    ajustes_resueltos = excluded.ajustes_resueltos,
    oc_creadas = excluded.oc_creadas,
    oc_abiertas = excluded.oc_abiertas,
    oc_vencidas = excluded.oc_vencidas,
    oc_sincronizadas_siigo = excluded.oc_sincronizadas_siigo,
    vehiculos_por_etapa = excluded.vehiculos_por_etapa,
    generado_at = now();

  perform fn_log_automatizacion_cerrar(v_log_id, 'ok', 1);
exception when others then
  perform fn_log_automatizacion_cerrar(v_log_id, 'error', 0, sqlerrm);
  raise;
end;
$$;
