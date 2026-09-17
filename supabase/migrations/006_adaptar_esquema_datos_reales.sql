create table bodegas (
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
  ('AUDIO Y VIDEO');

create table categorias_inventario (
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
  ('Servicios');

create table productos (
  codigo_producto text primary key,
  nombre_producto text not null,
  unidad_medida   text,
  categoria       text references categorias_inventario(nombre)
);

alter table movimientos_inventario rename column vin to codigo_producto;

alter table movimientos_inventario
  drop constraint if exists movimientos_inventario_vin_check;

alter table movimientos_inventario
  add constraint movimientos_inventario_codigo_producto_fk
  foreign key (codigo_producto) references productos(codigo_producto);

alter table movimientos_inventario
  add column bodega text references bodegas(nombre);

drop index if exists idx_mov_vin;
create index idx_mov_codigo_producto on movimientos_inventario(codigo_producto);
create index idx_mov_bodega          on movimientos_inventario(bodega);