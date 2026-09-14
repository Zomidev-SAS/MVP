-- Ampliar roles permitidos en profiles (metalmecanica, instalacion).

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
