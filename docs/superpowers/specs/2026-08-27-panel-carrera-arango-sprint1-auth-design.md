# Diseño: Panel Carrera Arango — Sprint 1 (Fundamentos y Autenticación)

**Fecha:** 2026-08-27
**Fuente:** `Documento_Iniciacion_Frontend_Carrera_Arango.md` (Sprint 1)
**Alcance de este spec:** SOLO Sprint 1. Dashboard, inventario, movimientos, ajustes, importación CSV y gestión de usuarios quedan fuera — se especificarán en sub-proyectos posteriores (Sprints 2-8).

## Contexto

Carrera Arango necesita un panel web (`panel.carreraarango.com`) que comparta autenticación con la app móvil iOS vía Supabase Auth. Este sub-proyecto entrega la base: proyecto Next.js inicializado, login funcional, protección de rutas por sesión, y lectura del rol del usuario desde la tabla `profiles`.

**Restricción actual:** el proyecto Supabase de producción/staging todavía no existe. El código se construye completo y correcto contra `@supabase/ssr`, apuntando a variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) que se completarán cuando el proyecto Supabase esté creado. No se usan mocks ni datos falsos: es el mismo código que correrá en producción, solo que aún no puede probarse end-to-end contra una base de datos real.

## Stack

- Next.js 14+ (App Router), TypeScript (`strict: true`, sin `any`)
- Tailwind CSS + shadcn/ui
- `@supabase/ssr` (NO `@supabase/auth-helpers-nextjs`, está deprecado)
- npm como gestor de paquetes

## Estructura de carpetas

```
app/
├── layout.tsx                 # Root layout: meta robots noindex, fuentes, providers globales
├── (auth)/
│   └── login/
│       └── page.tsx           # Página de login (pública)
├── (panel)/
│   ├── layout.tsx              # Layout protegido: valida sesión server-side, obtiene profile
│   └── page.tsx                 # Placeholder: "Bienvenida, {email} — Rol: {role}"
├── middleware.ts               # Middleware de sesión (raíz del proyecto, no dentro de app/)
lib/
├── supabase/
│   ├── client.ts               # createBrowserClient() para Client Components
│   └── server.ts               # createServerClient() para Server Components / middleware
└── types/
    └── database.ts             # Tipos: Profile, Role (union de los 7 roles de la matriz)
.env.local                      # Variables reales (gitignored)
.env.example                    # Plantilla con las claves esperadas, sin valores
```

Nota: `middleware.ts` vive en la raíz del proyecto (junto a `app/`), no dentro de `app/`, por requisito de Next.js — corrección respecto al diagrama ilustrativo del documento original.

## Componentes y flujo de datos

### 1. Clientes Supabase (`lib/supabase/`)

- `client.ts`: exporta `createClient()` usando `createBrowserClient` de `@supabase/ssr`, para uso en Client Components (el formulario de login).
- `server.ts`: exporta `createClient()` usando `createServerClient` de `@supabase/ssr`, leyendo/escribiendo cookies vía `next/headers`. Usado en Server Components, `middleware.ts` y el layout protegido.

### 2. Middleware (`middleware.ts`)

Se ejecuta en cada request (excepto assets estáticos). Lógica:

1. Crea cliente Supabase server-side con las cookies del request.
2. Llama `supabase.auth.getUser()`.
3. Si NO hay usuario y la ruta no es `/login` → `redirect('/login')`.
4. Si SÍ hay usuario y la ruta es `/login` → `redirect('/')` (evita ver login ya autenticado).
5. Refresca cookies de sesión en la respuesta (patrón estándar de `@supabase/ssr`).

### 3. Página de login (`app/(auth)/login/page.tsx`)

- Client Component. Formulario con email + contraseña (inputs controlados, sin React Hook Form todavía — se introduce en Sprint 5 cuando hay formularios más complejos; YAGNI para 2 campos).
- Sin autoregistro: no hay link ni ruta de "crear cuenta".
- Al enviar: `supabase.auth.signInWithPassword({ email, password })`.
- Maneja `{ error }` explícitamente: si falla, muestra mensaje inline (credenciales inválidas / error de red). Si tiene éxito: `router.push('/')` + `router.refresh()`.
- Estado de carga (spinner/disabled) mientras la petición está en curso.
- Visualmente sigue el mockup (logo, tarjeta centrada, tema oscuro). El link "¿Olvidaste tu contraseña?" se muestra pero sin funcionalidad (deshabilitado) — esa funcionalidad no está en el alcance de Sprint 1 del documento.

### 4. Layout protegido (`app/(panel)/layout.tsx`)

- Server Component. Segunda capa de defensa además del middleware (nunca confiar solo en middleware para lo que RLS también debe cubrir, pero aquí es solo control de acceso a la ruta, no a datos).
- Obtiene usuario vía `lib/supabase/server.ts`; si no hay sesión, redirect a `/login` (defensivo, aunque middleware ya debería haberlo bloqueado).
- Hace `select role from profiles where id = user.id`. Si la consulta falla o no hay fila, trata como error de configuración (mensaje claro, no crash silencioso).
- Renderiza children dentro de un contenedor mínimo (sin Sidebar/Header todavía — eso es Sprint 2).

### 5. Página placeholder (`app/(panel)/page.tsx`)

- Server Component simple que muestra el email y rol obtenidos del layout (via props o un helper compartido), confirmando visualmente que el pipeline auth → profile funciona.

## Manejo de errores

Toda llamada a Supabase (`signInWithPassword`, `getUser`, `select` de profiles) desestructura `{ data, error }` y evalúa `error` explícitamente antes de continuar. Nunca se ignora silenciosamente.

## Variables de entorno

- `.env.example` committeado con `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_ANON_KEY=` vacíos, documentando qué se necesita.
- `.env.local` en `.gitignore` desde el primer commit.
- Ninguna `service_role_key` en el código cliente (no aplica aún en Sprint 1, se usará recién en Sprint 7 vía Edge Function).

## Criterios de aceptación

Dado que el proyecto Supabase real todavía no existe, los criterios se dividen en lo verificable ahora y lo pendiente de credenciales reales:

**Verificable ahora (sin Supabase real):**
- `npm run build` y `npx tsc --noEmit` sin errores.
- `npm run dev` levanta el proyecto sin errores de consola.
- Visitar `/` sin cookies de sesión redirige a `/login`.
- La página `/login` renderiza el formulario correctamente.
- Código de `client.ts`, `server.ts` y `middleware.ts` sigue exactamente el patrón oficial de `@supabase/ssr` (verificado contra la documentación).

**Pendiente de credenciales reales (a validar cuando exista el proyecto Supabase):**
- Login con credenciales válidas redirige a `/` y renderiza el layout protegido con email + rol correctos.
- Login con credenciales inválidas muestra el mensaje de error sin redirigir.
- Logout invalida la sesión completamente (el botón de logout se agrega en Sprint 2 junto al Header; en Sprint 1 puede probarse manualmente vía `supabase.auth.signOut()` desde la consola del navegador si es necesario).

## Fuera de alcance (explícito)

- Sidebar, Header, RolGuard por ruta, página 403 → Sprint 2.
- Headers de seguridad HTTP en `next.config.ts` → Sprint 2.
- Dashboard con KPIs, gráficos, Realtime → Sprint 3.
- Cualquier pantalla del mockup de imagen que no sea login (Dashboard, Inventario, Movimientos, Nueva Entrada, Solicitar Ajuste) → sprints posteriores, specs separados.
- Creación del proyecto Supabase en sí (cuenta, org, billing) → acción del usuario, fuera del alcance de este código.
