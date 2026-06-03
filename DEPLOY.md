# Guía de Deployment — Gon-Cha Supply Tracker

## ✅ Estado actual
- [x] Código de la aplicación completo
- [x] Migración de base de datos ejecutada (schema `gongcha` creado con 8 tablas + 2 vistas)
- [ ] Deployment en Coolify (este documento)

---

## Paso 1: Subir código a GitHub

```bash
# Desde c:\saas-factory-v4\Gon-Cha
# 1. Crea un repositorio en github.com (private)
# 2. Conecta y push:
git remote add origin https://github.com/TU_USUARIO/gongcha-supply-tracker.git
git push -u origin master
```

---

## Paso 2: Configurar Coolify

1. Abre **http://5.252.53.169:8800** (Coolify)
2. Login: `rodonet.jarquin@gmail.com` / `HReforma2026!`

### Crear nueva aplicación

1. **Projects** → New Project → Name: `Gon-Cha`
2. **Add New Resource** → Application
3. Select server: `localhost`
4. Source: **GitHub** (conectar cuenta GitHub si no está conectada)
5. Repository: `gongcha-supply-tracker`
6. Branch: `master`
7. Build Pack: **Dockerfile**

### Variables de entorno (Settings → Environment Variables)

```
NEXT_PUBLIC_SUPABASE_URL=https://hreforma.rodosoft.digital
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3ODI2NjkyMCwiZXhwIjo0OTMzOTQwNTIwLCJyb2xlIjoiYW5vbiJ9.bjrX5M6tjxaf21Y9P1g6N86D3bAdRiXVqcsz81Rq4Nc
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3ODI2NjkyMCwiZXhwIjo0OTMzOTQwNTIwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.afyYqe5VU94qajrs1j1vue2EtFPbaVbcHt79TCBpVME
FOODBOT_EMAIL=rebeca@puertoescondido.ai
FOODBOT_PASSWORD=3758
FOODBOT_URL=https://dashboard.foodbot.ai
CRON_SECRET=gongcha-cron-2026
NEXT_PUBLIC_APP_URL=https://gongcha.rodosoft.digital
PORT=3000
HOSTNAME=0.0.0.0
```

### Dominio

- **Domains** → Add Domain: `gongcha.rodosoft.digital`
- Activar HTTPS (Let's Encrypt)

### Deploy

Click **Deploy** y espera 5-10 minutos para que construya el Docker image (instala Playwright + Chromium).

---

## Paso 3: Cron job automático (extracción cada lunes)

En Coolify → tu aplicación → Settings → Scheduled Tasks:
```
Name: weekly-extraction
Cron: 0 6 * * 1
Command: curl -s "https://gongcha.rodosoft.digital/api/cron?secret=gongcha-cron-2026"
```

---

## Verificación post-deployment

1. Abre `https://gongcha.rodosoft.digital/dashboard`
2. Ve a **Extractor** → selecciona la semana actual → **Iniciar extracción**
3. Espera que el scraper termine (puede tomar 10-30 minutos según la cantidad de pedidos)
4. Ve a **Pedidos** para ver los datos extraídos
5. Configura **Insumos** y **Recetas** para habilitar los reportes

---

## Notas de arquitectura

- El scraper usa Playwright en modo headless dentro del contenedor Docker
- La deduplicación se maneja vía `UNIQUE(external_id)` en la tabla `orders`
- El cron job usa `CRON_SECRET` para autenticación del endpoint
- El schema `gongcha` es independiente de otros proyectos en el mismo Supabase
