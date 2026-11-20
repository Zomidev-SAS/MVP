-- 057: endurece permisos de vistas expuestas (hallazgos del linter de Supabase).
--
-- Verificado contra el proyecto cloud:
--   - vista_usuarios_panel tenía ALL para anon (incluye SELECT sobre una vista
--     que une auth.users). Hoy anon recibe [] porque get_user_rol() es null sin
--     sesión, pero el acceso no debe depender solo de esa condición.
--   - vista_log_automatizaciones_ultimo_estado y vista_movimientos_por_dia
--     tenían ALL para authenticated. La app solo las lee (select), así que
--     sobran INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER.
--
-- No cambia security_invoker de ninguna vista: eso requiere probar cada rol
-- (supervisor, compras, auditoria, ...) antes de tocarlo.

-- 1) anon no debe tener ningún privilegio sobre vista_usuarios_panel.
revoke all on public.vista_usuarios_panel from anon;

-- 2) authenticated solo lee estas vistas.
revoke insert, update, delete, truncate, references, trigger on
  public.vista_usuarios_panel,
  public.vista_log_automatizaciones_ultimo_estado,
  public.vista_movimientos_por_dia
from authenticated;
