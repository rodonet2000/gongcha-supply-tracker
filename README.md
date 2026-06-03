# Gon-Cha Supply Tracker

Herramienta interna para calcular insumos semanales según ventas en Foodbot.ai

## Stack
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 3.4
- Supabase PostgreSQL (schema `gongcha`)
- Playwright (scraping de Foodbot.ai)
- Coolify (deployment en VPS)

## Setup rápido

### 1. Instalar dependencias
```bash
npm install
npm run playwright:install  # instala Chromium para el scraper
```

### 2. Variables de entorno
El `.env.local` ya está configurado con las credenciales del VPS.

### 3. Base de datos — ejecutar migración
Abre Supabase Studio: **https://hreforma.rodosoft.digital** → SQL Editor

Copia y ejecuta el contenido de:
```
supabase/migrations/001_gongcha_schema.sql
```

### 4. Desarrollo local
```bash
npm run dev
```
Abre http://localhost:3000

## Deployment en Coolify

### Opción A — Via GitHub/Gitea (recomendado)
1. Push este repositorio a GitHub/Gitea
2. En Coolify (http://5.252.53.169:8800), crear nuevo proyecto
3. Conectar repositorio → seleccionar Dockerfile
4. Agregar variables de entorno (ver .env.local.example)
5. Deploy

### Opción B — Git desde el VPS directamente
```bash
# En el VPS
mkdir /opt/gongcha && cd /opt/gongcha
git init --bare

# En tu máquina local (desde c:\saas-factory-v4\Gon-Cha)
git init
git remote add vps root@5.252.53.169:/opt/gongcha
git add .
git commit -m "Initial commit"
git push vps main
```

### Variables de entorno en Coolify
```
NEXT_PUBLIC_SUPABASE_URL=https://hreforma.rodosoft.digital
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOi...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOi...
FOODBOT_EMAIL=rebeca@puertoescondido.ai
FOODBOT_PASSWORD=3758
FOODBOT_URL=https://dashboard.foodbot.ai
CRON_SECRET=gongcha-cron-2026
NEXT_PUBLIC_APP_URL=https://gongcha.rodosoft.digital
PORT=3000
```

### Cron job automático (extracción cada lunes)
En Coolify → Settings → Scheduled Tasks:
```
Comando: curl -s "https://gongcha.rodosoft.digital/api/cron?secret=gongcha-cron-2026"
Cron: 0 6 * * 1  (lunes 6am)
```

## Módulos

| Módulo | URL | Descripción |
|--------|-----|-------------|
| Dashboard | `/dashboard` | Resumen semanal con top productos y canales |
| Extractor | `/extractor` | Extrae pedidos desde Foodbot.ai |
| Pedidos | `/pedidos` | Lista y detalle de pedidos extraídos |
| Insumos | `/insumos` | Catálogo de insumos (CRUD) |
| Recetas | `/recetas` | Recetas base y requerimientos por modificador |
| Reporte | `/reporte` | Insumos requeridos por semana |

## Flujo de uso

1. **Insumos**: Configura el catálogo de insumos (tapioca, leche, té, etc.)
2. **Recetas**: Define qué insumos usa cada producto del menú y cada modificador
3. **Extractor**: Selecciona la semana → extrae datos de Foodbot.ai
4. **Reporte**: Ve los insumos requeridos para esa semana
