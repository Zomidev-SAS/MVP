-- 061: órdenes de compra desde el documento de Siigo, con firma del administrador.
--
-- Cambio de flujo: la OC se elabora en Siigo y el panel la visualiza. En
-- Compras se sube el PDF que genera Siigo (OC-1-3195…), el panel lee los datos
-- y crea la orden; el administrador la firma con su firma precargada y se
-- notifica (panel + correo con el PDF firmado) a compras y al firmante.
--
-- Las OC creadas desde un documento YA existen en Siigo, por eso no se les
-- crea factura de compra al marcarlas como listas (evita duplicar).

-- ===================== 1) columnas =====================
alter table ordenes_compra
  add column if not exists numero_oc text,
  add column if not exists origen text not null default 'panel'
    check (origen in ('panel', 'documento_siigo')),
  add column if not exists documento_path text,
  add column if not exists documento_firmado_path text,
  add column if not exists firmada_at timestamptz,
  add column if not exists firmada_por uuid,
  add column if not exists total_pagar numeric;

-- Un mismo documento (número de OC de Siigo) no se sube dos veces.
create unique index if not exists ux_ordenes_compra_numero_oc
  on ordenes_compra (numero_oc) where numero_oc is not null;

-- Ruta (en el bucket privado firmas-admin) de la firma precargada de cada usuario.
alter table profiles
  add column if not exists firma_path text;

-- ===================== 2) almacenamiento privado =====================
insert into storage.buckets (id, name, public)
values ('ordenes-compra', 'ordenes-compra', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('firmas-admin', 'firmas-admin', false)
on conflict (id) do nothing;

-- Documentos de OC: leen todos los roles del panel; suben compras/supervisor
-- (originales) y solo supervisor (firmados).
drop policy if exists oc_docs_select on storage.objects;
create policy oc_docs_select on storage.objects
  for select to authenticated
  using (bucket_id = 'ordenes-compra' and public.get_user_rol() is not null);

drop policy if exists oc_docs_insert on storage.objects;
create policy oc_docs_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ordenes-compra'
    and (
      (name like 'originales/%' and public.get_user_rol() in ('supervisor', 'compras'))
      or (name like 'firmados/%' and public.get_user_rol() = 'supervisor')
    )
  );

-- Firmas: cada usuario solo puede leer la suya (carpeta = su id). Se cargan
-- con service_role, nunca desde el navegador.
drop policy if exists firmas_admin_select_propia on storage.objects;
create policy firmas_admin_select_propia on storage.objects
  for select to authenticated
  using (bucket_id = 'firmas-admin' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===================== 3) aviso de OC pendiente de firma =====================
create or replace function fn_oc_documento_subido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.documento_path is not null then
    perform fn_crear_notificacion(
      p_tipo        => 'oc_pendiente_firma',
      p_titulo      => 'Orden de compra pendiente de firma',
      p_mensaje     => 'La orden ' || coalesce(new.numero_oc, '#' || new.id) || ' está lista para firmar en Compras.',
      p_enlace      => '/compras',
      p_rol_destino => 'supervisor'
    );
  end if;
  return new;
end;
$$;

revoke all on function fn_oc_documento_subido() from public, anon, authenticated;

drop trigger if exists trg_oc_documento_subido on ordenes_compra;
create trigger trg_oc_documento_subido
  after insert on ordenes_compra
  for each row execute function fn_oc_documento_subido();

-- ===================== 4) firmar =====================
-- El panel estampa la firma en el PDF y sube el resultado; este RPC deja
-- constancia y avisa (notificación del panel + correo con el PDF firmado) al
-- firmante, a quien subió la OC y a los usuarios de compras.
create or replace function rpc_firmar_oc(
  p_orden_id      bigint,
  p_path_firmado  text,
  p_pdf_base64    text,
  p_nombre_firma  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden   ordenes_compra%rowtype;
  v_etiqueta text;
  v_nombre   text := coalesce(nullif(trim(p_nombre_firma), ''), 'el administrador');
  v_archivo  text;
  v_dest     record;
  v_notif_id bigint;
begin
  if coalesce(get_user_rol(), '') <> 'supervisor' then
    raise exception 'Solo el administrador (supervisor) puede firmar órdenes de compra';
  end if;

  select * into v_orden from ordenes_compra where id = p_orden_id for update;
  if not found then
    raise exception 'Orden de compra % no existe', p_orden_id;
  end if;
  if v_orden.documento_path is null then
    raise exception 'La orden % no tiene documento para firmar', p_orden_id;
  end if;
  if v_orden.firmada_at is not null then
    raise exception 'La orden % ya fue firmada', p_orden_id;
  end if;
  if p_path_firmado is null or p_path_firmado not like 'firmados/%' then
    raise exception 'Ruta del documento firmado inválida';
  end if;

  update ordenes_compra
  set documento_firmado_path = p_path_firmado,
      firmada_at = now(),
      firmada_por = auth.uid(),
      updated_at = now()
  where id = p_orden_id;

  v_etiqueta := coalesce(v_orden.numero_oc, '#' || v_orden.id);
  v_archivo  := regexp_replace(coalesce(v_orden.numero_oc, 'OC-' || v_orden.id), '[^A-Za-z0-9_-]', '_', 'g')
                || '-firmada.pdf';

  for v_dest in
    select distinct p.id
    from profiles p
    where p.activo
      and (p.rol = 'compras' or p.id = auth.uid() or p.id = v_orden.creado_por)
  loop
    insert into notificaciones (usuario_destino, tipo, titulo, mensaje, enlace)
    values (
      v_dest.id,
      'oc_firmada',
      'Orden de compra firmada',
      'La orden ' || v_etiqueta || ' fue firmada por ' || v_nombre || '.',
      '/compras'
    )
    returning id into v_notif_id;

    perform fn_encolar_correo(
      p_usuario_id     => v_dest.id,
      p_tipo           => 'oc_firmada:' || p_orden_id,
      p_asunto         => 'Orden de compra ' || v_etiqueta || ' firmada',
      p_cuerpo         => 'La orden de compra ' || v_etiqueta || ' fue firmada por ' || v_nombre
                          || E'.\nAdjuntamos el documento firmado.',
      p_origen         => 'oc_firmada:' || p_orden_id,
      p_enlace         => '/compras',
      p_adjunto_nombre => v_archivo,
      p_adjunto_base64 => p_pdf_base64
    );
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function rpc_firmar_oc(bigint, text, text, text) from public, anon;
grant execute on function rpc_firmar_oc(bigint, text, text, text) to authenticated;

-- ===================== 5) OC de documento: sin factura de compra en Siigo =====================
create or replace function rpc_marcar_oc_listo(
  p_orden_id   bigint,
  p_medio_pago text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden ordenes_compra%rowtype;
begin
  if coalesce(get_user_rol(), '') not in ('supervisor', 'compras') then
    raise exception 'Solo compras o supervisor pueden marcar una orden como lista';
  end if;

  select * into v_orden from ordenes_compra where id = p_orden_id for update;
  if not found then
    raise exception 'Orden de compra % no existe', p_orden_id;
  end if;

  if v_orden.estado = 'cancelada' then
    raise exception 'La orden % está cancelada, no se puede marcar como lista', p_orden_id;
  end if;

  -- La OC se elaboró en Siigo: el panel solo la visualiza, no se envía nada.
  if v_orden.origen = 'documento_siigo' then
    update ordenes_compra
    set estado        = 'listo',
        finalizada_at = coalesce(v_orden.finalizada_at, now()),
        medio_pago    = coalesce(p_medio_pago, v_orden.medio_pago),
        updated_at    = now()
    where id = p_orden_id;
    return jsonb_build_object('ok', true, 'ya_sincronizada', true, 'origen', 'documento_siigo');
  end if;

  if v_orden.siigo_id is null and exists (
    select 1 from orden_compra_items
    where orden_id = p_orden_id and precio_unitario is null
  ) then
    raise exception 'La orden % tiene líneas sin precio unitario. Edítala y agrega el precio (puede ser 0) antes de marcarla como lista.', p_orden_id;
  end if;

  update ordenes_compra
  set
    estado        = 'listo',
    finalizada_at = coalesce(v_orden.finalizada_at, now()),
    medio_pago    = coalesce(p_medio_pago, v_orden.medio_pago),
    siigo_estado  = case when v_orden.siigo_id is not null
                         then v_orden.siigo_estado
                         else 'enviando'
                    end,
    updated_at    = now()
  where id = p_orden_id;

  if v_orden.siigo_id is not null then
    return jsonb_build_object('ok', true, 'ya_sincronizada', true, 'siigo_id', v_orden.siigo_id);
  end if;

  perform fn_llamar_edge_function(
    'siigo-sync-oc',
    jsonb_build_object('orden_id', p_orden_id)
  );

  return jsonb_build_object('ok', true, 'ya_sincronizada', false);
end;
$$;

revoke execute on function rpc_marcar_oc_listo(bigint, text) from public, anon;
grant execute on function rpc_marcar_oc_listo(bigint, text) to authenticated;
