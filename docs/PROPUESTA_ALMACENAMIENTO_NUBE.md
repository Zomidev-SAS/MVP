# Propuesta — Almacenamiento en la nube integrado al Panel Carrera Arango

**Cliente:** Carrera Arango
**Proveedor del servicio:** ZomiDev S.A.S.
**Fecha:** octubre de 2026
**Valor total de la propuesta:** **$8.000.000 COP**

---

## 1. Contexto

Hoy el Panel Carrera Arango ya maneja el inventario, los movimientos, los ajustes, las órdenes de compra, el calendario, los usuarios con 8 roles y la integración con la app móvil y con Siigo. Corre sobre Supabase (base de datos, autenticación y funciones) y está publicado en un VPS.

Lo que falta es un lugar central y seguro para los **documentos, archivos y modelos** de la empresa: órdenes de compra en PDF, planos, modelos de diseño, fichas técnicas, soportes contables, fotos y archivos de producción. Son archivos pesados: se estima una migración inicial de **~2,5 TB** (entre 1,5 y 4 TB), y el volumen exacto se mide en el levantamiento, antes de migrar (ver sección 6). Ni el VPS actual ni el almacenamiento incluido en Supabase están pensados para ese volumen, ni en espacio ni en costo.

La empresa ya tiene previsto montar un **servidor propio en sus instalaciones**. Mientras ese servidor no esté listo, esta propuesta ofrece una solución en la nube que funciona desde ya, conectada al panel, y que se puede trasladar a ese servidor cuando esté disponible sin rehacer el trabajo.

---

## 2. Qué se propone

Implementar un **almacenamiento en la nube con Microsoft Azure (Azure Blob Storage)**, conectado al panel, de forma que:

1. El usuario entra al panel, abre la sección **Archivos**, elige el tipo de archivo y da clic en **Subir**.
2. El archivo se sube **directamente a Azure**, a la carpeta que le corresponde según su tipo y según el rol del usuario, con barra de progreso, aunque pese varios GB.
3. El panel guarda el registro de cada archivo (nombre, carpeta, tamaño, quién lo subió y cuándo), así que se puede buscar, filtrar y descargar desde el mismo panel.
4. Cada rol del panel solo ve y sube a las carpetas que tiene permitidas.
5. Todos los archivos que la empresa tiene hoy se **migran una sola vez** a la nube, organizados en esa misma estructura.

---

## 3. Alcance

### Incluido

| Componente | Descripción |
|---|---|
| **Disposición de la nube** | Creación de la cuenta de almacenamiento en Azure **a nombre de la empresa**, estructura de carpetas (contenedores), cifrado, acceso público bloqueado, transferencia solo por HTTPS, versionado y papelera de recuperación (soft delete). |
| **Niveles de almacenamiento** | Configuración de niveles por uso (caliente, frío y archivo) y reglas automáticas que mueven a niveles más baratos los archivos que no se consultan, para bajar el costo mensual. |
| **Roles y accesos** | Mapeo de los 8 roles actuales del panel (supervisor, comercial, metalmecánica, producción, instalación, compras, auditoría, lectura) a permisos por carpeta: quién sube, quién consulta, quién elimina. |
| **Conexión con el panel (backend)** | Funciones en Supabase que validan al usuario y su rol, generan un permiso de subida temporal y seguro (SAS de 15 minutos) para la carpeta correcta, confirman la subida y registran el archivo. Tabla `archivos` con seguridad por rol (RLS). |
| **Conexión con el panel (pantalla)** | Nueva sección **Archivos** en el panel: botón de subir con arrastrar y soltar, barra de progreso, subida por partes con reintento para archivos grandes, listado por carpeta, búsqueda, filtros y descarga. |
| **Migración inicial** | Inventario de los archivos existentes, organización en la estructura acordada, carga masiva con AzCopy, verificación de integridad (que cada archivo llegó completo) e informe final de lo migrado. |
| **Pruebas y entrega** | Pruebas con archivos de varios GB y con cada rol, manual de uso, documentación técnica, una sesión de capacitación y **1 mes de acompañamiento** después de la entrega. |
| **Preparación para el servidor propio** | La conexión se construye desacoplada del proveedor (un adaptador de almacenamiento), y se entrega un documento con el plan para pasar los archivos y la conexión al servidor de la empresa cuando esté listo. |

### No incluido

- El **pago mensual a Azure** por el espacio usado. Lo paga la empresa directamente a Microsoft (ver sección 6).
- El **mantenimiento mensual** después del mes de acompañamiento. Se puede contratar aparte si se desea.
- La **migración al servidor propio**. Se cotiza aparte cuando el servidor esté listo; esta propuesta deja todo preparado para que sea un traslado y no un desarrollo nuevo.
- Volúmenes de migración inicial por encima de **4 TB** (el rango alto de la estimación). Si el inventario da más, el excedente se cotiza aparte antes de migrarlo.
- Compra o configuración del servidor físico de la empresa.

---

## 4. La elección: por qué Azure

Se evaluaron Azure, AWS S3, Google Cloud, Wasabi, Backblaze B2, Cloudflare R2 y el almacenamiento propio de Supabase. Se elige **Azure Blob Storage** por estas razones:

1. **Archivos muy pesados sin pasar por nuestro servidor.** El navegador sube el archivo directo a Azure por partes. El VPS no se satura y se pueden subir archivos de varios GB con barra de progreso y reintento si se cae el internet.
2. **Permisos finos.** Azure permite dar accesos temporales y limitados a una sola carpeta, que es justo lo que se necesita para respetar los roles del panel.
3. **Niveles de costo.** Lo que se usa a diario queda en el nivel caliente; lo que casi no se consulta pasa solo a niveles mucho más baratos. Así se reduce el costo mensual de forma importante frente a tener todo en el mismo nivel.
4. **Durabilidad y respaldo.** Azure guarda varias copias de cada archivo (durabilidad de 99,999999999 %) y permite versionado y recuperación de archivos borrados por error.
5. **Ecosistema empresarial.** Si la empresa usa o va a usar Microsoft 365, se integra con sus cuentas; y la facturación es formal y a nombre de la empresa.
6. **Transición al servidor propio.** Los archivos se pueden descargar completos con AzCopy, y la conexión con el panel se construye desacoplada. Además, cuando el servidor propio esté funcionando, Azure se puede dejar como **copia de respaldo externa** en el nivel de archivo, que cuesta muy poco.

**Por qué no las otras opciones:**

- **Supabase Storage:** con varios TB es más caro, tiene límites de tamaño por archivo y cobra la descarga de datos.
- **El VPS actual:** no tiene ni el espacio ni la redundancia para este volumen, y comparte recursos con otros sitios.
- **Wasabi o Backblaze:** son más baratos por TB, pero tienen menos control de permisos y menos respaldo empresarial. Se pueden considerar más adelante como capa fría si se quiere bajar aún más el costo.

---

## 5. Almacenamiento

### Estructura de carpetas propuesta (se ajusta con el cliente)

```
Cuenta de almacenamiento Azure — Carrera Arango
├── documentos/        → contratos, fichas técnicas, manuales, soportes
├── ordenes-compra/    → PDF de órdenes de compra y cotizaciones
├── modelos/           → modelos de diseño, planos, archivos CAD / 3D
├── produccion/        → fotos y archivos de producción e instalación
├── archivos/          → otros archivos generales
└── respaldos/         → copias de seguridad (solo sistema y supervisor)
```

### Niveles según uso

| Tipo de archivo | Nivel en Azure | Motivo |
|---|---|---|
| Modelos y documentos en uso activo | Caliente (Hot) | Se abren a diario |
| Documentos consultados de vez en cuando | Frío (Cool) | Mitad de precio que caliente |
| Archivos viejos y respaldos | Archivo (Archive / Cold) | Costo mínimo, casi nunca se consultan |

Regla automática sugerida: lo que no se abre en 30 días pasa a frío y lo que no se abre en 180 días pasa a archivo.

### Región

Se recomienda una región cercana a Colombia (Brazil South o East US 2) para que las subidas y descargas sean rápidas.

---

## 6. Migración inicial y costo de Azure (lo paga la empresa directamente)

Valores aproximados a una tasa de $4.200 COP por dólar.

### Cuánto pesaría la migración inicial

El volumen exacto se mide en la **semana 1** con un inventario de los archivos actuales. Para planear desde ya, esta es una estimación por tipo de archivo. El peso de las órdenes de compra es un dato real, tomado de las OC que ya maneja la empresa; los demás pesos son promedios típicos de cada tipo de archivo, y las cantidades son una suposición para una empresa de fabricación de muebles con varios años de operación.

| Tipo de archivo | Peso promedio por archivo | Cantidad estimada | Peso total estimado |
|---|---|---|---|
| Órdenes de compra y cotizaciones (PDF) | ~0,4 MB | ~20.000 | ~8 GB |
| Documentos, fichas técnicas, contratos, hojas de cálculo | ~1 MB | ~50.000 | ~50 GB |
| Fotos de producción e instalación | ~4 MB | ~100.000 | ~400 GB |
| Planos (DWG / PDF de planos) | ~20 MB | ~20.000 | ~400 GB |
| Modelos 3D y renders | ~200 MB | ~5.000 | ~1.000 GB |
| Videos | ~500 MB | ~1.000 | ~500 GB |
| Respaldos existentes | — | — | ~200 GB |
| **Total estimado de la migración inicial** | | | **~2,5 TB** |

**Rango probable: entre 1,5 TB y 4 TB.** Lo que más mueve el total son los modelos 3D, los videos y las fotos. Si la empresa tiene muchos más modelos o videos de los supuestos, el volumen sube; si la mayoría son documentos y PDF, baja.

### Cuánto cuesta guardar ese volumen

Los archivos se reparten en niveles según su uso (30 % caliente, 50 % frío, 20 % archivo), lo que deja un costo promedio de **~$47.000 por TB al mes**.

| Volumen que resulte del inventario | Espacio guardado al mes | Al año |
|---|---|---|
| ~1,5 TB (rango bajo) | ~$70.500 | ~$846.000 |
| **~2,5 TB (estimado)** | **~$117.500** | **~$1.410.000** |
| ~4 TB (rango alto) | ~$188.000 | ~$2.256.000 |

Este es el valor fijo de cada mes: lo que cuesta tener los archivos guardados, aunque nadie los abra.

### Cómo sería el uso en el mes

Además del espacio guardado, se paga por **usar** los archivos: subirlos, abrirlos, verlos desde el panel y descargarlos. Esto depende de cuánto trabaje el equipo con los archivos, no de cuánto haya guardado.

Así se cobra cada acción:

| Acción del usuario | ¿Se cobra? | Cuánto (aprox.) |
|---|---|---|
| **Subir** un archivo desde el panel | Solo una fracción por operación; el peso subido es gratis | Subir 10.000 archivos ≈ $210 – $420 en total |
| **Ver o abrir** un archivo en el panel | Cuenta como descarga: se cobra lo que pesa el archivo | Ver un PDF de OC (~0,4 MB) ≈ $0,15 · abrir un modelo de 200 MB ≈ $73 |
| **Descargar** un archivo al computador | Se cobra lo que pesa. Los **primeros 100 GB del mes son gratis** | ~$365 por GB después de los primeros 100 GB |
| Abrir un archivo guardado en **nivel frío** | Pequeño cobro adicional por GB | ~$42 por GB (frío) · ~$126 (Cold) · ~$84 (archivo) |
| **Listar o buscar** archivos en el panel | Fracción por operación | Prácticamente nada (~$17 por cada 10.000 consultas) |
| **Borrar** un archivo | Gratis | $0 (salvo los tiempos mínimos de los niveles fríos, ver más abajo) |

Como referencia, **300 GB descargados al mes** equivalen a unas 20 personas abriendo unos 700 MB de archivos cada día hábil. Por ejemplo, unos cuantos planos, fotos y uno que otro modelo 3D cada uno.

### Costo total estimado al mes (espacio + uso)

Con la migración inicial estimada de **~2,5 TB**:

| Concepto | Uso bajo | Uso normal | Uso alto |
|---|---|---|---|
| Cómo es el uso | Se consultan sobre todo documentos y PDF | El equipo abre a diario planos y fotos, y algunos modelos | Se descargan seguido modelos 3D y videos |
| Descargas y vistas en el mes | ~100 GB | ~300 GB | ~800 GB |
| Espacio guardado (fijo) | $117.500 | $117.500 | $117.500 |
| Descargas y vistas | $0 (dentro de los 100 GB gratis) | ~$73.000 | ~$255.500 |
| Subidas, consultas y recuperación de niveles fríos | ~$5.000 | ~$10.000 | ~$25.000 |
| **Total al mes** | **~$122.500** | **~$200.000** | **~$398.000** |
| Con IVA (19 %) | ~$146.000 | ~$239.000 | ~$474.000 |
| **Total al año** | ~$1.470.000 | ~$2.400.000 | ~$4.776.000 |
| Al año con IVA | ~$1.750.000 | ~$2.860.000 | ~$5.680.000 |

**Crecimiento:** como los archivos se conservan y no se borran, cada mes se suma lo nuevo que se suba. Por ejemplo, si se suben unos 200 GB nuevos al mes, la factura aumenta unos $9.400 cada mes siguiente. Al cabo de un año serían unos 2,4 TB más, con un costo de alrededor de $113.000 adicionales al mes.

### Cómo funciona el cobro por uso

Funciona como los servicios públicos: no hay una tarifa fija mensual. Azure mide lo que se usó durante el mes y lo cobra al mes siguiente.

1. **Cómo se mide.** Azure mide cada hora cuánto espacio hay ocupado y saca el promedio del mes. Si un archivo de 1 TB se sube el día 15, se cobra solo medio mes de ese TB.
2. **Cómo se factura.** Al cerrar cada mes, Microsoft emite la factura **en dólares** y la cobra a la tarjeta o al medio de pago registrado a nombre de la empresa. El valor en pesos varía según el dólar del día del cobro. Según cómo se facture, se pueden sumar el IVA (19 %) y la comisión del banco por compra internacional.
3. **Sin permanencia.** Se paga solo lo que se usa, mes a mes. Se puede reducir o cancelar en cualquier momento, que es lo que conviene mientras se pone en marcha el servidor propio.
4. **Tarifas oficiales de Azure (LRS):**

| Concepto | Tarifa oficial | En pesos (aprox.) |
|---|---|---|
| Espacio caliente | US$0,0184 por GB al mes | ~$79.000 por TB al mes |
| Espacio frío | US$0,01 por GB al mes | ~$43.000 por TB al mes |
| Espacio Cold | US$0,0036 por GB al mes | ~$15.500 por TB al mes |
| Espacio de archivo | US$0,002 por GB al mes | ~$8.600 por TB al mes |
| Subidas (escritura) | US$0,05 – US$0,10 por cada 10.000 | ~$210 – $420 por cada 10.000 |
| Lecturas | US$0,004 – US$0,01 por cada 10.000 | ~$17 – $42 por cada 10.000 |
| Recuperación de niveles fríos | US$0,01 – US$0,03 por GB | ~$42 – $126 por GB |
| Descargas (salida de datos) | Primeros 100 GB gratis; después ~US$0,087 por GB | ~$365 por GB |

5. **Tiempos mínimos de los niveles fríos.** Cada nivel frío tiene un tiempo mínimo: 30 días en frío, 90 días en Cold y 180 días en archivo. Si un archivo se borra o se cambia de nivel antes, Azure cobra los días que faltaban. Además, un archivo en el nivel de archivo no se abre al instante: puede tardar hasta 15 horas, o menos de 1 hora pagando una tarifa prioritaria (~$420 por GB). Por eso al nivel de archivo solo van respaldos y archivos que casi nunca se consultan, y las reglas automáticas se configuran para no generar estos cobros.

Para que la factura no suba por las vistas, se recomienda guardar en la nube los originales y mostrar en el panel versiones livianas o vistas previas cuando aplique (por ejemplo, miniaturas de fotos o un PDF del plano en lugar del archivo CAD completo).

### Cuál es el límite

**De espacio, prácticamente no hay límite.** Una cuenta de almacenamiento de Azure admite hasta 5 PB (unos 5.000 TB), y un solo archivo puede pesar hasta unos 190 TB. La empresa puede crecer sin cambiar de plan ni avisar a nadie: simplemente se cobra lo que se ocupe.

**De gasto, Azure no pone un tope automático** en el pago por uso: si se sube o se descarga más, la factura sube. Para que la empresa siempre tenga el control, en la implementación se configuran:

| Control | Cómo funciona |
|---|---|
| **Presupuesto mensual en Azure** | Se define con el volumen real del inventario. Con la estimación de ~2,5 TB, por ejemplo, $250.000 COP al mes. |
| **Alertas por correo** | Azure avisa al responsable de la empresa y a ZomiDev cuando el gasto llega al 80 %, 100 % y 120 % del presupuesto. Las alertas avisan; no apagan el servicio, para no dejar a la empresa sin acceso a sus archivos. |
| **Reglas automáticas de niveles** | Mueven a niveles más baratos lo que no se usa, para que el costo no crezca de más. |
| **Límites desde el panel** | Si la empresa lo desea, el panel puede limitar el tamaño máximo por archivo, las carpetas donde puede subir cada rol o el espacio por área. |
| **Reporte mensual** | Durante el acompañamiento se entrega un resumen de espacio ocupado, descargas y costo, para ajustar el presupuesto con datos reales. |

### ¿Y la suscripción anual?

Azure ofrece un descuento si se compromete capacidad por 1 o 3 años (capacidad reservada), pero **solo se vende en bloques mínimos de 100 TB**, y se paga aunque no se use. Precios oficiales de Microsoft para el bloque más pequeño (100 TB, LRS):

| Nivel | 1 año: mensual | 1 año: total anual | 3 años: mensual | 3 años: total anual |
|---|---|---|---|---|
| Caliente (Hot) | US$1.545 (~$6.489.000) | US$18.540 (~$77.868.000) | US$1.244 (~$5.225.000) | US$14.928 (~$62.698.000) |
| Frío (Cool) | US$840 (~$3.528.000) | US$10.080 (~$42.336.000) | US$676 (~$2.839.000) | US$8.112 (~$34.070.000) |
| Archivo (Archive) | US$183 (~$769.000) | US$2.196 (~$9.223.000) | US$168 (~$706.000) | US$2.016 (~$8.467.000) |

**Comparación con el volumen estimado (~2,5 TB, uso normal):**

| Modalidad | Costo anual aproximado |
|---|---|
| **Pago por uso** | **~$2.400.000** |
| Reserva de 1 año en nivel frío (bloque mínimo de 100 TB) | ~$42.336.000 |

Con la reserva anual se pagarían 100 TB para usar unos 2,5, así que saldría alrededor de **17 veces más caro**. La reserva solo conviene cuando la empresa supere unos 85 TB en un mismo nivel. Por eso se recomienda el **pago por uso**.

La cuenta queda a nombre de la empresa, así que la empresa ve y controla su factura directamente con Microsoft.

---

## 7. Lo que se necesita del cliente

1. **Acceso a los archivos actuales** (disco, servidor, computador o carpetas compartidas donde están hoy).
2. **Cuenta de Azure a nombre de la empresa** con un medio de pago. Se acompaña la creación.
3. **Definición de carpetas y permisos:** qué tipos de archivo hay y qué rol puede ver o subir cada uno. Se propone una matriz inicial para que el cliente solo la valide.
4. **Internet con buena velocidad de subida** en el sitio desde donde se hace la migración. Como referencia, a 100 Mbps de subida se migra alrededor de 1 TB por día continuo, así que los ~2,5 TB estimados tardarían unos 2 a 3 días (unos 5 días a 50 Mbps). Si el internet es más lento, se evalúa enviar los datos con un dispositivo físico de Azure (Data Box).
5. **Un responsable por parte de la empresa** para resolver dudas y aprobar cada etapa.
6. **Lista de usuarios** que van a usar la sección de archivos y su rol.

---

## 8. Paso a paso

1. **Levantamiento e inventario.** Reunión con el cliente y medición de los archivos actuales: peso total, cantidad, tipos y frecuencia de uso. Con eso se confirma el costo mensual real de Azure, se definen carpetas y permisos por rol y se planea la migración.
2. **Disposición de Azure.** Creación de la cuenta, estructura de carpetas, cifrado, bloqueo de acceso público, versionado, papelera de recuperación y reglas de niveles.
3. **Roles y accesos.** Matriz de permisos por carpeta para los 8 roles del panel, aprobada por el cliente.
4. **Conexión backend.** Tabla `archivos` en Supabase con seguridad por rol y funciones para solicitar la subida, confirmarla, descargar y eliminar.
5. **Sección Archivos en el panel.** Botón de subir, arrastrar y soltar, progreso, subida por partes, listado, búsqueda y descarga.
6. **Migración inicial.** Organización de los archivos existentes, carga masiva, verificación de integridad y registro de cada archivo en el panel para que aparezcan desde el primer día.
7. **Pruebas.** Archivos de varios GB, cortes de conexión, cada rol revisando que solo ve lo suyo y recuperación de un archivo borrado.
8. **Entrega.** Manual de uso, documentación técnica, plan de paso al servidor propio y capacitación.
9. **Acompañamiento.** Un mes de soporte para ajustes y dudas.

---

## 9. Cronograma

Duración estimada: **6 semanas** desde la firma y la entrega de accesos.

| Semana | Actividades | Entregable |
|---|---|---|
| **1** | Levantamiento e inventario de los archivos actuales, creación de la cuenta de Azure, estructura de carpetas, seguridad y niveles | Informe de volumen real con costo mensual confirmado, nube configurada y matriz de permisos aprobada |
| **2** | Roles y accesos, tabla `archivos`, funciones de subida y descarga en Supabase | Backend de archivos funcionando |
| **3** | Sección **Archivos** en el panel (subir, progreso, listado, búsqueda, descarga) | Botón de subir funcionando contra Azure |
| **4 – 5** | Migración inicial de los archivos existentes, verificación de integridad y registro en el panel | Informe de migración (archivos, tamaño, verificación) |
| **6** | Pruebas finales, documentación, plan de paso al servidor propio y capacitación | Entrega formal y acta de recibido |
| **7 – 10** | Acompañamiento | Soporte y ajustes |

La migración (semanas 4 y 5) puede empezar antes y correr en paralelo con el desarrollo, según la velocidad del internet del cliente.

---

## 10. Inversión

| Concepto | Valor (COP) |
|---|---|
| Levantamiento y diseño de la solución | $400.000 |
| Disposición de Azure (cuenta, carpetas, seguridad, niveles, versionado) | $900.000 |
| Roles y accesos por carpeta (8 roles del panel) | $700.000 |
| Conexión backend con el panel (Supabase: tabla, seguridad y funciones) | $1.500.000 |
| Sección Archivos en el panel (subida, progreso, listado, búsqueda, descarga) | $1.500.000 |
| Migración inicial de archivos existentes (hasta 4 TB) con inventario y verificación | $2.200.000 |
| Pruebas, documentación, capacitación, plan de paso al servidor propio y 1 mes de acompañamiento | $800.000 |
| **TOTAL** | **$8.000.000** |

### Forma de pago sugerida

| Momento | Porcentaje | Valor |
|---|---|---|
| Al firmar e iniciar | 40 % | $3.200.000 |
| Al entregar la conexión con el panel funcionando (fin semana 3) | 30 % | $2.400.000 |
| Al terminar la migración y la entrega formal (fin semana 6) | 30 % | $2.400.000 |

---

## 11. Sobre el servidor propio de la empresa

Se deja claro que **la intención de la empresa es usar en un tiempo cercano el servidor propio establecido en sus instalaciones** como lugar principal de almacenamiento. Esta propuesta **no reemplaza ese plan**: es la solución para que la empresa tenga desde ya sus archivos centralizados, seguros y conectados al panel mientras ese servidor se pone en marcha.

Para que el paso sea sencillo:

- La conexión del panel con el almacenamiento se construye **independiente del proveedor**. Cambiar de Azure al servidor propio es cambiar el adaptador de almacenamiento y trasladar los archivos, no rehacer la sección de archivos ni los permisos.
- Los registros de los archivos viven en la base de datos del panel, así que se conservan en el traslado.
- Se entrega un **plan de transición** con los pasos, los tiempos estimados y lo que debe tener el servidor (espacio, respaldo y acceso seguro desde internet).
- Cuando el servidor propio esté funcionando, la recomendación es **conservar Azure como copia de respaldo externa** en el nivel de archivo, con un costo muy bajo, para que la información no dependa de un solo lugar físico.

---

## 12. Vigencia

Esta propuesta tiene una vigencia de **30 días** a partir de su fecha. Los costos de Azure son referenciales y dependen de las tarifas de Microsoft y del tipo de cambio al momento de la facturación.
