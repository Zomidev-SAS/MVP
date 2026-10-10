# Panel Carrera Arango

Panel de gestión de inventario para Carrera Arango, construido con Next.js y Supabase.

## Requisitos

- Node.js 20 o superior
- npm

## Instalación

```bash
npm install
```

Copia el archivo de variables de entorno de ejemplo y complétalo:

```bash
cp .env.example .env.local
```

## Variables de entorno (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Estas dos son obligatorias para conectar con un proyecto Supabase real (URL y anon key del proyecto, disponibles en su dashboard).

### Bypass de autenticación para desarrollo (sin Supabase real)

Si todavía no existe un proyecto Supabase (o solo querés previsualizar el panel), agrega en `.env.local`:

```
DEV_SKIP_AUTH=true
DEV_SKIP_AUTH_ROLE=supervisor
```

Esto omite el login y simula una sesión con el rol indicado. `DEV_SKIP_AUTH_ROLE` acepta cualquiera de: `supervisor`, `comercial`, `ingenieria`, `produccion`, `compras`, `auditoria`, `lectura`. **Solo funciona en desarrollo** — se ignora automáticamente si `NODE_ENV=production`.

Después de cambiar `.env.local`, reinicia `npm run dev` (Next.js no recarga archivos de entorno en caliente).

## Ejecutar en desarrollo

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) en el navegador.

## Build de producción

```bash
npm run build
npm run start
```
