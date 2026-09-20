-- Seed final: formularios de ejemplo (forma compatible con vehiculosapp).
-- Usar tipos distintos de 'ingreso' para no disparar el webhook durante db reset.
insert into formularios (id, tipo, data, created_at)
values
  (
    'form-ejemplo-ingreso-1',
    'entrada',
    '{
      "tipoFormulario": "ingreso",
      "datosGenerales": {
        "chasis": "10024",
        "marca": "Productos CA",
        "fechaIngreso": "2026-09-18T10:00:00.000Z"
      }
    }'::jsonb,
    now() - interval '2 days'
  ),
  (
    'form-ejemplo-salida-1',
    'salida',
    '{
      "tipoFormulario": "salida",
      "datosGenerales": {
        "chasis": "10050",
        "marca": "Productos CA",
        "fechaSalida": "2026-09-17T15:30:00.000Z"
      }
    }'::jsonb,
    now() - interval '1 day'
  )
on conflict (id) do nothing;
