-- Ejecutar en Supabase → SQL Editor si falla crear usuarios con rol
-- metalmecanica, instalacion, etc. (error profiles_rol_check).

alter table public.profiles drop constraint if exists profiles_rol_check;

alter table public.profiles add constraint profiles_rol_check check (
  rol in (
    'supervisor',
    'comercial',
    'ingenieria',
    'produccion',
    'compras',
    'auditoria',
    'lectura',
    'metalmecanica',
    'instalacion'
  )
);
