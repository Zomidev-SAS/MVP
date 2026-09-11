# Panel Carrera Arango — Monorepo

Proyecto unificado con **frontend** (Next.js) y **backend** (Supabase: migraciones, RLS, Edge Functions).

## Estructura

```
├── frontend/          # Panel Next.js (App Router)
├── supabase/          # Backend: migraciones, seed, Edge Functions
│   ├── migrations/
│   ├── functions/
│   └── seed.sql
└── docs/              # Specs, planes y estado del proyecto
```

## Ramas

| Rama | Contenido |
|------|-----------|
| `main` | Frontend + backend integrados (rama de trabajo principal) |
| `frontend` | Solo panel Next.js |
| `master` | Solo migraciones Supabase originales |

## Requisitos

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- Docker (para Supabase local)

## 1. Levantar Supabase local

Desde la raíz del repo:

```bash
supabase start
```

Copia las credenciales que imprime el comando (URL y `anon key`).

Para aplicar migraciones y datos de prueba desde cero:

```bash
supabase db reset
```

Usuarios de prueba (contraseña `test1234`):

| Email | Rol |
|-------|-----|
| supervisor@test.local | supervisor |
| comercial@test.local | comercial |
| produccion@test.local | produccion |
| compras@test.local | compras |
| auditoria@test.local | auditoria |

## 2. Conectar el frontend

```bash
cd frontend
cp .env.example .env.local
```

Edita `frontend/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key de supabase status>
```

Quita o comenta `DEV_SKIP_AUTH` para usar login real:

```
# DEV_SKIP_AUTH=true
# DEV_SKIP_AUTH_ROLE=supervisor
```

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000/login](http://localhost:3000/login) e iniciá sesión con `supervisor@test.local` / `test1234`.

## 3. Edge Functions (local)

Con Supabase corriendo:

```bash
supabase functions serve
```

Funciones incluidas:

- `aprobar-ajuste` — aplica un ajuste pendiente como movimiento de inventario
- `crear-usuario` — crea usuario Auth + perfil (solo supervisor)

## Estado de integración

Ver `docs/ESTADO_INTEGRACION.md` para qué está listo y qué falta probar contra Supabase real (cloud).

## Documentación del frontend

Detalle de instalación y variables: `frontend/README.md`.
