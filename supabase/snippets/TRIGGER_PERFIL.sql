insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values ('99999999-9999-9999-9999-999999999999', 'trigger-test@test.local', crypt('test1234', gen_salt('bf')), now(), '{"nombre":"Trigger Test"}');

do $$
declare
  perfil_existe boolean;
begin
  select exists(
    select 1 from profiles where id = '99999999-9999-9999-9999-999999999999'
  ) into perfil_existe;

  if not perfil_existe then
    raise exception 'FALLÓ: el trigger handle_new_user no creó el perfil';
  end if;

  raise notice 'OK: perfil creado automáticamente al insertar en auth.users';
end $$;

delete from auth.users where id = '99999999-9999-9999-9999-999999999999';