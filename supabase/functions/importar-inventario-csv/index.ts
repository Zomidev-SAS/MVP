import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { parse } from 'https://deno.land/std@0.224.0/csv/mod.ts'

const MAX_FILAS = 500
const UMBRAL_ERROR = 0.30

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // Cliente en CONTEXTO del usuario, para que RLS decida si puede insertar
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('MI_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: userData } = await supabaseUser.auth.getUser(token)
  if (!userData?.user) {
    return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401 })
  }

  // B6: acceso solo supervisor/compras
  const { data: perfil } = await supabaseUser
    .from('profiles')
    .select('rol, activo')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (!perfil?.activo || !['supervisor', 'compras'].includes(perfil.rol)) {
    return new Response(JSON.stringify({ error: 'Forbidden: solo supervisor o compras' }), { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return new Response(JSON.stringify({ error: 'Se esperaba multipart/form-data con un archivo CSV' }), { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'Falta el archivo CSV (campo "file")' }), { status: 400 })
  }

  const texto = await file.text()
  let filas: string[][]
  try {
    filas = (await parse(texto)) as string[][]
  } catch (e) {
    return new Response(JSON.stringify({ error: 'No se pudo leer el CSV: ' + String(e) }), { status: 400 })
  }

  const [encabezado, ...datos] = filas
  if (!encabezado) {
    return new Response(JSON.stringify({ error: 'CSV vacío' }), { status: 400 })
  }

  // B6: tope de 500 filas
  if (datos.length > MAX_FILAS) {
    return new Response(
      JSON.stringify({ error: `El CSV tiene ${datos.length} filas, el máximo permitido es ${MAX_FILAS}` }),
      { status: 400 }
    )
  }

  const idxCodigo = encabezado.indexOf('codigo_producto')
  const idxCantidad = encabezado.indexOf('cantidad')
  const idxBodega = encabezado.indexOf('bodega')
  const idxValorUnitario = encabezado.indexOf('valor_unitario')

  if (idxCodigo === -1 || idxCantidad === -1) {
    return new Response(
      JSON.stringify({ error: 'El CSV debe tener al menos las columnas: codigo_producto, cantidad' }),
      { status: 400 }
    )
  }

  const { data: productos } = await supabaseUser.from('productos').select('codigo_producto')
  const codigosValidos = new Set((productos ?? []).map((p: any) => p.codigo_producto))

  const { data: bodegas } = await supabaseUser.from('bodegas').select('nombre')
  const bodegasValidas = new Set((bodegas ?? []).map((b: any) => b.nombre))

  type Valida = { codigo_producto: string; cantidad: number; bodega: string; valor_unitario: number | null }
  const validas: Valida[] = []
  const errores: { fila: number; motivo: string }[] = []

  datos.forEach((fila, i) => {
    const numeroFila = i + 2 // fila 1 = encabezado
    const codigo = fila[idxCodigo]?.trim()
    const cantidadTexto = fila[idxCantidad]?.trim()
    const bodega = idxBodega !== -1 ? (fila[idxBodega]?.trim() || 'Sin Asignar') : 'Sin Asignar'
    const valorTexto = idxValorUnitario !== -1 ? fila[idxValorUnitario]?.trim() : undefined

    if (!codigo) {
      errores.push({ fila: numeroFila, motivo: 'codigo_producto vacío' })
      return
    }
    if (!codigosValidos.has(codigo)) {
      errores.push({ fila: numeroFila, motivo: `codigo_producto "${codigo}" no existe en el catálogo` })
      return
    }
    const cantidad = Number(cantidadTexto)
    if (!cantidadTexto || isNaN(cantidad) || cantidad <= 0) {
      errores.push({ fila: numeroFila, motivo: 'cantidad debe ser un número mayor a 0' })
      return
    }
    if (!bodegasValidas.has(bodega)) {
      errores.push({ fila: numeroFila, motivo: `bodega "${bodega}" no existe` })
      return
    }
    const valorUnitario = valorTexto ? Number(valorTexto) : null
    if (valorTexto && isNaN(valorUnitario as number)) {
      errores.push({ fila: numeroFila, motivo: 'valor_unitario inválido' })
      return
    }

    validas.push({ codigo_producto: codigo, cantidad, bodega, valor_unitario: valorUnitario })
  })

  const totalFilas = datos.length
  const tasaError = totalFilas > 0 ? errores.length / totalFilas : 0

  // B6: abortar todo el lote si errores > 30%
  if (tasaError > UMBRAL_ERROR) {
    return new Response(
      JSON.stringify({
        exitosas: 0,
        errores,
        abortado: true,
        motivo_abortado: `${(tasaError * 100).toFixed(1)}% de filas con error, supera el umbral de 30%`
      }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (validas.length === 0) {
    return new Response(
      JSON.stringify({ exitosas: 0, errores, abortado: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Insertar todas las filas válidas en un solo INSERT (atómico como sentencia)
  const idempotencyBase = `csv:${crypto.randomUUID()}`
  const filasParaInsertar = validas.map((v, i) => ({
    codigo_producto: v.codigo_producto,
    tipo_movimiento: 'entrada',
    cantidad: v.cantidad,
    valor_unitario: v.valor_unitario,
    bodega: v.bodega,
    actor_id: userData.user.id,
    idempotency_key: `${idempotencyBase}-${i}`
  }))

  const { data: insertados, error } = await supabaseUser
    .from('movimientos_inventario')
    .insert(filasParaInsertar)
    .select('id')

  if (error) {
    return new Response(
      JSON.stringify({ exitosas: 0, errores: [{ fila: 0, motivo: 'Error al insertar: ' + error.message }], abortado: true }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ exitosas: insertados?.length ?? 0, errores, abortado: false }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})