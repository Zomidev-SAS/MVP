-- F8: desactivar a un usuario le corta el acceso de inmediato, sin esperar a
-- que expire su token. current_user_rol() (migracion 006) ya retorna null si
-- activo=false (es security definer, no le aplica esta misma policy), asi que
-- basta con exigir que no sea null en las policies de lectura mas amplias
-- para que un usuario desactivado deje de poder leer nada aunque su sesión
-- siga técnicamente vigente.

drop policy if exists "usuarios autenticados leen perfiles" on public.profiles;
create policy "usuarios activos leen perfiles"
  on public.profiles for select
  to authenticated
  using (current_user_rol() is not null);

drop policy if exists "usuarios autenticados leen movimientos" on public.movimientos_inventario;
create policy "usuarios activos leen movimientos"
  on public.movimientos_inventario for select
  to authenticated
  using (current_user_rol() is not null);
