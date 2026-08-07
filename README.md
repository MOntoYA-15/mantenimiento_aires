# Sistema de Mantenimiento de Aires Acondicionados
### Le Café & Punta Brasas

Aplicación web completa para gestionar el mantenimiento preventivo y de emergencia de aires acondicionados en las sucursales de **Le Café** y **Punta Brasas**.

---

## Características

- **Sucursales**: Alta manual de sucursales con:
  - Dirección
  - Cantidad de **Mini Split**
  - Cantidad de **equipos grandes / potentes**
  - Cantidad de **bombas de condensación**
  - Tiempo estimado de mantenimiento
  - Orden en el ciclo de visitas

- **Ruta diaria automática**: El sistema genera la ruta del día basándose en el ciclo. Cuando se terminan todas las sucursales, vuelve a empezar desde la primera.

- **Emergencias** (escala 1-5): Se insertan en la ruta con prioridad.

- **Problemas**: Gerentes, técnicos y administradores pueden reportar problemas con **fotos y videos**.

- **Roles con inicio de sesión**:
  | Rol        | Qué puede hacer                                      |
  |------------|------------------------------------------------------|
  | Admin      | Todo (sucursales, rutas, problemas, emergencias)     |
  | Técnico    | Ver ruta, completar visitas, reportar problemas      |
  | Gerente    | Reportar problemas de su sucursal                    |

- Interfaz moderna, intuitiva y elegante.

---

## Cómo subirlo para que funcione a la perfección

### 1. Crear proyecto en Supabase (gratis)

1. Ve a https://supabase.com y crea una cuenta.
2. Crea un nuevo proyecto.
3. Ve a **SQL Editor** y pega el contenido completo del archivo `supabase/schema.sql`. Ejecútalo.
4. Ve a **Storage** → Create bucket → nombre: `archivos` → Public bucket: **Sí**.
5. En **Authentication → Providers** asegúrate de que Email esté activado.
6. Copia la **URL** y la **anon key** de Settings → API.

### 2. Configurar el proyecto localmente

```bash
cd ac-maintenance
cp .env.local.example .env.local
```

Edita `.env.local` y pega tus valores:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 3. Instalar dependencias y correr

```bash
npm install
npm install @supabase/supabase-js @supabase/ssr clsx tailwind-merge date-fns lucide-react
npm run dev
```

Abre http://localhost:3000

### 4. Subir a producción (Vercel – gratis y perfecto)

1. Sube el código a un repositorio de GitHub.
2. Ve a https://vercel.com → Import project → selecciona el repo.
3. En Environment Variables agrega las mismas dos variables de `.env.local`.
4. Deploy.

Tu sistema quedará en una URL tipo `https://tu-proyecto.vercel.app`

---

## Primer usuario administrador

1. Regístrate desde la pantalla de login.
2. En Supabase → Table Editor → `perfiles` → edita tu usuario y cambia el `rol` a `admin`.

---

## Estructura principal

```
src/
├── app/
│   ├── (auth)/login/          → Login / Registro
│   ├── (dashboard)/
│   │   ├── dashboard/         → Panel principal
│   │   ├── sucursales/        → CRUD de sucursales
│   │   ├── ruta/              → Ruta del día + completar visitas
│   │   ├── problemas/         → Reportar problemas + imágenes/videos
│   │   ├── emergencias/       → Listado de emergencias
│   │   └── historial/         → Visitas completadas
├── lib/supabase/              → Clientes de Supabase
├── types/database.ts          → Tipos TypeScript
└── middleware.ts              → Protección de rutas
```

---

## Ajustes recomendados

- En la página de **Ruta** puedes cambiar cuántas sucursales se programan por día (variable `porDia`).
- Puedes asignar roles (`admin`, `tecnico`, `gerente`) desde la tabla `perfiles` en Supabase.
- El bucket de Storage `archivos` debe ser público para que se vean las imágenes.

---

Hecho para Le Café & Punta Brasas
