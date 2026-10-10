-- ============================================================
-- REPAIR: cloud con historial 006 pero schema VIN legacy (vehiculosapp)
-- Idempotente — seguro en local donde 006 ya corrió de verdad.
-- ============================================================

create table if not exists bodegas (
  nombre text primary key
);

insert into bodegas (nombre) values
  ('Sin Asignar'),
  ('ALMACEN NIVEL 1'),
  ('ALMACEN NIVEL 2'),
  ('ALMACEN NIVEL 3'),
  ('METALMECANICA'),
  ('PRODUCTO TERMINADO'),
  ('MADERAS'),
  ('DESCANSABRAZOS'),
  ('AUDIO Y VIDEO')
on conflict (nombre) do nothing;

create table if not exists categorias_inventario (
  nombre text primary key
);

insert into categorias_inventario (nombre) values
  ('TORNILLERIA'),
  ('Productos'),
  ('MECANIZADOS'),
  ('PERFILERIA'),
  ('TELAS Y TAPICERIA'),
  ('DESCANSABRAZOS'),
  ('PRODUCTO TERMINADO'),
  ('Productos CA'),
  ('Otro CA'),
  ('INSUMOS VARIOS'),
  ('FIBRA'),
  ('ELECTRICOS'),
  ('CORTE LASER'),
  ('PEGANTES E INFLAMABLES'),
  ('AUDIO Y VIDEO'),
  ('CA IMPORTACIONES'),
  ('Servicios')
on conflict (nombre) do nothing;

create table if not exists productos (
  codigo_producto text primary key,
  nombre_producto text not null,
  unidad_medida   text,
  categoria       text references categorias_inventario(nombre)
);

-- Catálogo mínimo desde movimientos legacy (columna vin)
insert into productos (codigo_producto, nombre_producto, unidad_medida, categoria)
select distinct
  trim(m.vin),
  coalesce(nullif(trim(m.marca), ''), trim(m.vin)),
  'unidad',
  nullif(trim(m.categoria), '')
from movimientos_inventario m
where m.vin is not null and trim(m.vin) <> ''
on conflict (codigo_producto) do nothing;

-- Catálogo desde vehiculosapp (columnas dg_chasis / dg_marca)
insert into productos (codigo_producto, nombre_producto, unidad_medida, categoria)
select distinct
  trim(f.dg_chasis),
  coalesce(nullif(trim(f.dg_marca), ''), trim(f.dg_chasis)),
  'unidad',
  'Productos CA'
from formularios f
where f.dg_chasis is not null and trim(f.dg_chasis) <> ''
on conflict (codigo_producto) do nothing;

-- Catálogo desde inventario_saldos legacy si existe
insert into productos (codigo_producto, nombre_producto, unidad_medida, categoria)
select distinct
  trim(s.codigo),
  coalesce(nullif(trim(s.nombre), ''), trim(s.codigo)),
  coalesce(nullif(trim(s.unidad), ''), 'unidad'),
  nullif(trim(s.categoria), '')
from inventario_saldos s
where s.codigo is not null and trim(s.codigo) <> ''
on conflict (codigo_producto) do nothing;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'movimientos_inventario' and column_name = 'vin'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'movimientos_inventario' and column_name = 'codigo_producto'
  ) then
    alter table movimientos_inventario rename column vin to codigo_producto;
  end if;
end $$;

alter table movimientos_inventario drop constraint if exists movimientos_inventario_vin_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'movimientos_inventario_codigo_producto_fk'
  ) then
    alter table movimientos_inventario
      add constraint movimientos_inventario_codigo_producto_fk
      foreign key (codigo_producto) references productos(codigo_producto);
  end if;
end $$;

alter table movimientos_inventario
  add column if not exists bodega text references bodegas(nombre);

update movimientos_inventario
set bodega = coalesce(nullif(trim(ubicacion), ''), 'Sin Asignar')
where bodega is null;

drop index if exists idx_mov_vin;
create index if not exists idx_mov_codigo_producto on movimientos_inventario(codigo_producto);
create index if not exists idx_mov_bodega on movimientos_inventario(bodega);

-- ============================================================
-- Vistas multibodega (requieren codigo_producto)
-- ============================================================

drop view if exists vista_movimientos_recientes;
drop view if exists vista_valorizacion_basica;
drop view if exists vista_inventario_actual;
drop view if exists vista_inventario_por_bodega;

create view vista_inventario_por_bodega as
select
  m.codigo_producto,
  p.nombre_producto,
  p.unidad_medida,
  p.categoria,
  m.bodega,
  sum(m.cantidad) as saldo,
  max(m.valor_unitario) as valor_unitario,
  sum(m.cantidad) * max(coalesce(m.valor_unitario, 0)) as valor_total,
  max(m.created_at) as ultimo_movimiento
from movimientos_inventario m
join productos p on p.codigo_producto = m.codigo_producto
where m.estado = 'aplicado'
group by m.codigo_producto, p.nombre_producto, p.unidad_medida, p.categoria, m.bodega;

create view vista_inventario_actual as
select
  m.codigo_producto,
  p.nombre_producto,
  p.unidad_medida,
  p.categoria,
  sum(m.cantidad) as saldo,
  max(m.valor_unitario) as valor_unitario,
  sum(m.cantidad) * max(coalesce(m.valor_unitario, 0)) as valor_total,
  max(m.created_at) as ultimo_movimiento
from movimientos_inventario m
join productos p on p.codigo_producto = m.codigo_producto
where m.estado = 'aplicado'
group by m.codigo_producto, p.nombre_producto, p.unidad_medida, p.categoria;

create view vista_valorizacion_basica as
select
  coalesce(categoria, 'Sin categoría') as categoria,
  sum(saldo) as unidades,
  sum(valor_total) as valor_total
from vista_inventario_actual
group by categoria;

create view vista_movimientos_recientes as
select
  m.*,
  pr.nombre as actor_nombre,
  pr.rol as actor_rol,
  p.nombre_producto as producto_nombre
from movimientos_inventario m
left join profiles pr on m.actor_id = pr.id
left join productos p on p.codigo_producto = m.codigo_producto
order by m.created_at desc
limit 100;
