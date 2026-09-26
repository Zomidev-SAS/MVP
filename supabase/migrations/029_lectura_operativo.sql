-- Rol lectura: ver procesos del vehículo y formularios operativos (sin inventario en UI).

drop policy if exists vehiculo_procesos_select on vehiculo_procesos;
create policy vehiculo_procesos_select on vehiculo_procesos
  for select using (get_user_rol() is not null);

drop policy if exists formularios_select_panel on formularios;
create policy formularios_select_panel on formularios
  for select using (
    get_user_rol() in (
      'supervisor', 'comercial', 'metalmecanica', 'produccion',
      'instalacion', 'compras', 'auditoria', 'lectura'
    )
  );
