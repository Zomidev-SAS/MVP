create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  rol        text not null check (rol in (
                'supervisor','comercial','ingenieria',
                'produccion','compras','auditoria','lectura')),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, nombre, rol)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre',''), 'lectura');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();