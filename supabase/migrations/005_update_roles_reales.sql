alter table profiles drop constraint profiles_rol_check;

alter table profiles add constraint profiles_rol_check check (rol in (
  'supervisor','comercial','metalmecanica','produccion','instalacion',
  'compras','auditoria','lectura'
));