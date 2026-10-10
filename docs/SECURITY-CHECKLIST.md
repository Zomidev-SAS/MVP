# Checklist de seguridad — producción

## Supabase Dashboard (manual, obligatorio)

- [ ] **Authentication → Providers → Email**: desactivar **Enable sign ups**
- [ ] **Authentication → URL Configuration**:
  - Site URL: `https://carrera.zomidev.com`
  - Redirect URLs: `https://carrera.zomidev.com/auth/callback`
- [ ] Aplicar migración `023_security_hardening.sql` (`supabase db push` o SQL Editor)
- [ ] Desplegar Edge Functions: `sync-inventario-vin`, `reactivar-usuario`
- [ ] Edge Function secrets: `MI_ANON_KEY`, `MI_SERVICE_ROLE_KEY` configurados

## Verificación post-deploy

```bash
# sync-inventario-vin debe rechazar token inválido (401):
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  'https://TU_PROYECTO.supabase.co/functions/v1/sync-inventario-vin' \
  -H 'Authorization: Bearer invalido' \
  -H 'Content-Type: application/json' \
  -d '{"formulario_id":"x","codigo_producto":"Y","bodega":"Sin Asignar"}'
```

Esperado: **401**
