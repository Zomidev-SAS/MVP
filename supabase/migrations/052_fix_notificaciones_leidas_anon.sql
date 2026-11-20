-- 052: notificaciones_leidas (049) quedó con `anon` teniendo GRANT de
-- SELECT/INSERT/UPDATE en el proyecto real -- probablemente se creó una vez
-- desde el Table Editor visual en vez de pegar el SQL crudo, y Supabase le
-- da acceso a anon por defecto así. No es hueco de datos (RLS ya bloquea
-- todo: `usuario_id = auth.uid()` nunca es true sin sesión, confirmado
-- insertando como anon -- responde "new row violates row-level security
-- policy", no filtra ni acepta nada), pero no sigue la convención del resto
-- de tablas del proyecto (grant explícito solo a `authenticated`).

revoke all on notificaciones_leidas from anon, public;
