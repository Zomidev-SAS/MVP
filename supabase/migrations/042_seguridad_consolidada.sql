-- B9: Seguridad de lo nuevo (consolidado). Las tablas de la Sección 2 ya
-- nacieron con RLS habilitado en su propia migración (031, 033, 034, 036,
-- 037, 038, 039); este archivo es la verificación explícita que pide el
-- criterio de aceptación: deja constancia, en una sola migración, de que
-- ninguna quedó abierta y de que eventos_sistema / log_automatizaciones /
-- cola_correos están restringidas a supervisor y auditoría.

do $$
declare
  v_tabla text;
  v_rls_ok boolean;
  v_tablas text[] := array[
    'eventos_sistema', 'notificaciones', 'alertas_stock_bajo', 'sync_pendientes',
    'log_automatizaciones', 'cola_correos', 'kpi_diario'
  ];
begin
  foreach v_tabla in array v_tablas loop
    select relrowsecurity into v_rls_ok
    from pg_class where relname = v_tabla and relnamespace = 'public'::regnamespace;

    if not coalesce(v_rls_ok, false) then
      raise exception 'B9: la tabla % no tiene RLS habilitado', v_tabla;
    end if;
  end loop;

  raise notice 'B9: RLS verificado en % tablas nuevas', array_length(v_tablas, 1);
end $$;

-- Ninguna tabla "solo supervisor/auditoría" otorga INSERT/UPDATE/DELETE a
-- authenticated: toda escritura pasa por una función SECURITY DEFINER o por
-- una Edge Function con service_role. Se deja explícito con REVOKE (aunque
-- nunca se otorgó) para que quede documentado y sea a prueba de futuros
-- GRANT accidentales.
revoke insert, update, delete on eventos_sistema      from authenticated;
revoke insert, update, delete on log_automatizaciones from authenticated;
revoke insert, update, delete on cola_correos         from authenticated;
revoke insert, update, delete on sync_pendientes      from authenticated;
revoke insert, update, delete on kpi_diario           from authenticated;

-- notificaciones: tampoco se otorga UPDATE directo — solo a través de
-- marcar_notificacion_leida / marcar_todas_leidas (033).
revoke insert, update, delete on notificaciones from authenticated;

-- alertas_stock_bajo: solo lectura (supervisor/compras/auditoria, ya
-- declarado en 034); nunca escritura directa.
revoke insert, update, delete on alertas_stock_bajo from authenticated;

comment on table eventos_sistema is
  'Solo supervisor/auditoría leen (B9). Escritura solo por triggers SECURITY DEFINER.';
comment on table log_automatizaciones is
  'Solo supervisor/auditoría leen (B9). Escritura solo por funciones SECURITY DEFINER y Edge Functions.';
comment on table cola_correos is
  'Solo supervisor/auditoría leen (B9). Contiene direcciones de correo: nunca exponer a otros roles. Escritura solo vía fn_encolar_correo (SECURITY DEFINER) y la Edge Function enviar-correos (service_role).';

-- Recordatorio en texto, para quien audite las migraciones: los secrets de
-- Siigo (SIIGO_*) y del proveedor de correo (RESEND_API_KEY) viven SOLO como
-- variables de entorno de las Edge Functions (supabase secrets set ...).
-- Ninguna migración de esta sección los referencia ni los necesita: las
-- llamadas salientes a APIs externas (Siigo, Resend) las hace exclusivamente
-- el código Deno de supabase/functions/, nunca una función SQL.
