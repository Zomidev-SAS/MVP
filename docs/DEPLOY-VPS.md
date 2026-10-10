# Despliegue VPS — Panel Carrera Arango (carrera.zomidev.com)

Reemplaza la antigua **CarreraApp de formularios** por el **panel de inventario** de este repo.

## Ramas y flujo de trabajo

| Rama | Uso |
|------|-----|
| `main` | Desarrollo diario (local, features, PRs) |
| **`production`** | **Solo lo que se sube al VPS** (`carrera.zomidev.com`) |

### Publicar cambios al VPS

En tu máquina local, cuando algo esté listo para producción:

```bash
git checkout main
git pull origin main

git checkout production
git pull origin production
git merge main          # o cherry-pick de commits concretos
git push origin production
```

En el VPS:

```bash
cd /opt/carrera-panel/app/docker
./update.sh            # hace git pull de production + rebuild Docker
```

> El VPS **nunca** debe hacer `git pull` de `main`. Solo `production`.

---

## Arquitectura (3 sitios en el mismo VPS)

```
Cloudflare
   │
   ▼
wingconcept_nginx (80/443)
   ├── wingconcept.com       → WingConcept
   ├── zomidev.com           → 172.17.0.1:8080 (ZomiDev)
   └── carrera.zomidev.com   → 172.17.0.1:8081 (Panel Carrera — este repo)
```

El proxy de `carrera.zomidev.com` en WingConcept **no cambia**; solo se sustituye lo que escucha en el puerto **8081**.

## Supabase (obligatorio antes del deploy)

En el proyecto Supabase de Carrera Arango:

1. **Authentication → URL Configuration**
   - Site URL: `https://carrera.zomidev.com`
   - Redirect URLs: `https://carrera.zomidev.com/auth/callback`
2. Usuarios del panel deben existir en `auth.users` + `profiles`.

## Primera vez en el VPS

```bash
sudo mkdir -p /opt/carrera-panel
sudo chown $USER:$USER /opt/carrera-panel
cd /opt/carrera-panel
git clone -b production https://github.com/Zomidev-SAS/MVP.git app
cd app/docker
cp .env.production.example .env
nano .env   # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
chmod +x deploy.sh update.sh
./deploy.sh
```

## Migrar desde CarreraApp (formularios)

```bash
docker compose -p carrera down   # stack viejo de ZomiDev, si aplica
cd /opt/carrera-panel/app/docker
./deploy.sh
```

## Actualizar (día a día)

Tras `git push origin production` desde tu máquina:

```bash
cd /opt/carrera-panel/app/docker
./update.sh
```

`update.sh` hace `git pull origin production`, preserva `docker/.env` y reconstruye contenedores.

## Verificación

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://172.17.0.1:8081/login   # 200
curl -I https://carrera.zomidev.com/login                              # 200
```

En el navegador: login → dashboard con inventario, movimientos, etc.

## Variables (`docker/.env`)

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase Carrera |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `NEXT_PUBLIC_SITE_URL` | `https://carrera.zomidev.com` |
| `CARRERA_NGINX_BIND` | `172.17.0.1` |
| `CARRERA_NGINX_PORT` | `8081` |

No subas `.env` a GitHub.
