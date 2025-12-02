# Sistema de Gestión de Vacaciones y Permisos - CNI

Sistema web moderno para la gestión de solicitudes de vacaciones y permisos laborales, desarrollado con Next.js 14, TypeScript, TailwindCSS y PostgreSQL.

## 🚀 Características Principales

### ✨ Funcionalidades Implementadas

- **Gestión de Solicitudes**
  - Formulario intuitivo adaptado del formato en papel
  - Sección de permisos (1-2hrs, 2-4hrs, día completo)
  - Sección de vacaciones con cálculo automático de días
  - Balance en tiempo real (disponibles - solicitados = restantes)
  - Validación automática de disponibilidad

- **Flujo de Aprobación**
  - 1️⃣ Empleado crea solicitud → Estado: `pendiente`
  - 2️⃣ Jefe Inmediato aprueba → Estado: `aprobada_jefe`
  - 3️⃣ RRHH aprueba → Estado: `aprobada`
  - ❌ Cualquiera puede rechazar → Estado: `rechazada`

- **Tipos de Ausencias Configurables**
  - Vacaciones
  - Permiso Personal
  - Permiso Médico
  - Permiso Maternidad/Paternidad
  - Permiso Estudio
  - Permiso Duelo
  - Otros

- **Roles de Usuario**
  - `esJefe`: Puede aprobar solicitudes de su departamento
  - `esRrhh`: Puede aprobar solicitudes ya aprobadas por jefes
  - `esAdmin`: Acceso total al sistema

## 🗂️ Estructura del Proyecto

```
vacaciones-cni/
├── database/                          # Scripts SQL de instalación
│   ├── 01_tipos_enums.sql            # ENUMs: estado_solicitud, tipo_ausencia, etc.
│   ├── 02_tablas_principales.sql     # departamentos, usuarios, tipos_ausencia_config
│   ├── 03_balances_solicitudes.sql   # balances_ausencias, solicitudes (particionado)
│   ├── 04_vistas_funciones.sql       # Vistas y funciones helper
│   ├── 05_datos_iniciales.sql        # 7 departamentos, 2 usuarios, 8 tipos, balances
│   └── README.md                     # Guía de instalación de BD
│
├── src/
│   ├── lib/
│   │   └── db/
│   │       ├── index.ts              # Cliente Drizzle ORM con Neon
│   │       └── schema.ts             # Schema completo (6 tablas, 4 ENUMs, relaciones)
│   │
│   ├── types/
│   │   └── index.ts                  # TypeScript types (20+ tipos)
│   │
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── login/route.ts    # POST /api/auth/login
│   │   │   ├── solicitudes/
│   │   │   │   └── route.ts          # GET, POST, PATCH solicitudes
│   │   │   ├── balances/
│   │   │   │   └── route.ts          # GET balances por usuario/año
│   │   │   ├── usuarios/
│   │   │   │   └── route.ts          # GET, POST, PATCH usuarios
│   │   │   ├── departamentos/
│   │   │   │   └── route.ts          # GET departamentos
│   │   │   └── tipos-ausencia/
│   │   │       └── route.ts          # GET tipos activos
│   │   │
│   │   ├── login/page.tsx            # Página de login
│   │   ├── dashboard/page.tsx        # Dashboard principal
│   │   ├── solicitudes/
│   │   │   ├── page.tsx              # Listado de solicitudes
│   │   │   └── nueva/page.tsx        # Nueva solicitud
│   │   └── ...
│   │
│   └── components/
│       ├── FormularioSolicitud.tsx   # Formulario modernizado (⭐ NUEVO)
│       └── TablaSolicitudes.tsx      # Listado con aprobaciones (⭐ NUEVO)
│
├── drizzle.config.ts                 # Configuración Drizzle Kit
├── tailwind.config.ts                # TailwindCSS 4.0 + DaisyUI
├── package.json
└── .env.local                        # DATABASE_URL
```

## 📦 Tecnologías

| Categoría | Tecnología | Versión |
|-----------|-----------|---------|
| **Framework** | Next.js | 14.2.18 |
| **Lenguaje** | TypeScript | 5.6.3 |
| **Base de Datos** | PostgreSQL | 16+ |
| **ORM** | Drizzle ORM | 0.36.4 |
| **Conexión DB** | @neondatabase/serverless | 0.10.3 |
| **UI Framework** | TailwindCSS | 4.0 |
| **Componentes** | DaisyUI | 5.3.7 |
| **Autenticación** | bcryptjs | 3.0.3 |
| **Package Manager** | pnpm | Latest |

## 🛠️ Instalación

### 1. Clonar y Configurar Proyecto

```powershell
git clone <repo-url>
cd vacaciones-cni
pnpm install
```

**Dependencias principales instaladas:**
- `next-auth@beta` - Autenticación con NextAuth v5
- `@auth/core` - Core de autenticación
- `bcryptjs` - Hashing de contraseñas

### 2. Configurar Base de Datos

#### Opción A: PostgreSQL Local (pgAdmin)

1. Abrir pgAdmin
2. Crear base de datos `vacaciones`
3. Ejecutar scripts en orden:
   ```
   01_tipos_enums.sql
   02_tablas_principales.sql
   03_balances_solicitudes.sql
   04_vistas_funciones.sql
   05_datos_iniciales.sql
   ```

#### Opción B: Neon Database (Cloud)

1. Crear proyecto en [Neon](https://neon.tech)
2. Ejecutar scripts en SQL Editor
3. Copiar connection string

### 3. Variables de Entorno

Crear archivo `.env.local`:

```env
# Base de Datos
DATABASE_URL="postgresql://user:pass@ep-xxx.aws.neon.tech/vacaciones?sslmode=require"

# NextAuth (Autenticación)
AUTH_SECRET="tu-secreto-super-seguro-aqui"
NEXTAUTH_URL="http://localhost:3000"
```

**Generar AUTH_SECRET:**
```powershell
openssl rand -base64 32
# O en PowerShell:
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### 4. Ejecutar Proyecto

```powershell
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## 👥 Usuarios de Prueba

| Email | Contraseña | Roles |
|-------|-----------|-------|
| admin@cni.gob.ni | Admin123! | Admin + RRHH + Jefe |
| rrhh@cni.gob.ni | RRHH123! | RRHH + Jefe |

## 📋 Estructura de Base de Datos

### Tablas Principales

#### `departamentos`
- Estructura jerárquica (padre/hijos)
- 7 departamentos iniciales

#### `usuarios`
- Roles: `es_jefe`, `es_rrhh`, `es_admin`
- Soft delete con `deleted_at`
- Índices en email, departamento, activo

#### `tipos_ausencia_config`
- 8 tipos configurados con colores
- Flags: `requiere_aprobacion_jefe`, `permite_horas`, `requiere_documento`

#### `balances_ausencias`
- Columna calculada: `cantidad_disponible = cantidad_asignada - cantidad_utilizada - cantidad_pendiente`
- Por usuario + tipo + año
- Índices en usuario_id + anio

#### `solicitudes` (PARTICIONADA por año)
- Código auto-generado: `SOL-2025-001234`
- Estados: borrador → pendiente → aprobada_jefe → aprobada
- Campos de aprobación: `aprobado_por`, `aprobado_rrhh_por`, `fecha_aprobacion_jefe`, `fecha_aprobacion_rrhh`
- Particiones: 2025, 2026
- Soft delete

## 🔌 API Endpoints

### Autenticación
```typescript
POST /api/auth/login
Body: { email: string, password: string }
Response: { success: boolean, user: SessionUser }
```

### Solicitudes
```typescript
// Listar con filtros
GET /api/solicitudes?usuarioId=1&estado=pendiente&page=1&pageSize=20
Response: PaginatedResponse<SolicitudCompleta>

// Crear nueva
POST /api/solicitudes
Body: NuevaSolicitud
Response: { success: boolean, data: SolicitudCompleta }

// Aprobar/Rechazar
PATCH /api/solicitudes
Body: { solicitudId: number, accion: 'aprobar_jefe' | 'aprobar_rrhh' | 'rechazar', usuarioId: number }
Response: { success: boolean, message: string }
```

### Balances
```typescript
GET /api/balances?usuarioId=1&anio=2025
Response: { success: boolean, data: BalanceCompleto[] }
```

### Usuarios
```typescript
GET /api/usuarios?departamentoId=1&activo=true
POST /api/usuarios (crear)
PATCH /api/usuarios (actualizar)
```

### Tipos de Ausencia
```typescript
GET /api/tipos-ausencia
Response: { success: boolean, data: TipoAusenciaConfig[] }
```

## 🎨 Componentes UI

### `<FormularioSolicitud />`

Formulario adaptado del papel:

```tsx
<FormularioSolicitud
  usuarioId={1}
  onSuccess={() => router.push('/solicitudes')}
  onCancel={() => router.back()}
/>
```

**Características:**
- Selección dinámica de tipo (permiso/vacaciones)
- Cálculo automático de días disponibles
- Validación de balance en tiempo real
- Secciones visuales separadas (permisos en azul, vacaciones en verde)

### `<TablaSolicitudes />`

Lista con aprobaciones:

```tsx
<TablaSolicitudes
  usuarioId={usuarioActual.id}  // Opcional: filtrar por usuario
  esJefe={usuarioActual.esJefe}
  esRrhh={usuarioActual.esRrhh}
/>
```

**Características:**
- Filtros por estado
- Paginación
- Botones de aprobación según rol
- Códigos de colores por estado

## 🔒 Seguridad

- ✅ Contraseñas hasheadas con bcrypt (salt rounds: 10)
- ✅ Validación de datos en API routes
- ✅ Soft delete para auditoría
- ✅ Columna `version` para control optimista de concurrencia
- ✅ **NextAuth v5** con JWT tokens
- ✅ **Middleware de autenticación** protegiendo rutas
- ✅ **Sesiones seguras** con strategy JWT (24 horas)
- ⏳ **Pendiente:** Rate limiting
- ⏳ **Pendiente:** CSRF protection avanzada

## 📊 Flujo de Datos

```
1. Usuario crea solicitud → POST /api/solicitudes
   - Valida tipo de ausencia activo
   - Valida usuario activo
   - Crea solicitud en estado "pendiente"
   - Genera código automático (SOL-YYYY-NNNNNN)

2. Jefe aprueba → PATCH /api/solicitudes (aprobar_jefe)
   - Actualiza estado a "aprobada_jefe"
   - Registra aprobado_por y fecha_aprobacion_jefe

3. RRHH aprueba → PATCH /api/solicitudes (aprobar_rrhh)
   - Actualiza estado a "aprobada"
   - Registra aprobado_rrhh_por y fecha_aprobacion_rrhh
   - ⏳ TODO: Actualizar balance (restar cantidad)

4. Balance actualizado
   - cantidad_utilizada += cantidad_solicitada
   - cantidad_pendiente -= cantidad_solicitada
   - cantidad_disponible se recalcula automáticamente
```

## 🐛 Debug y Logs

Ver logs en terminal:
```powershell
# Next.js dev server muestra logs de API routes
pnpm dev
```

Verificar conexión a BD:
```typescript
// src/lib/db/index.ts lanza error si DATABASE_URL no existe
console.log('DB conectada:', process.env.DATABASE_URL)
```

## 📝 Próximos Pasos

### Alta Prioridad
- [x] Implementar sistema de sesiones con NextAuth v5
- [x] Middleware de autenticación protegiendo rutas
- [x] Páginas frontend usando sesión real
- [ ] Actualizar balance automáticamente al aprobar solicitud
- [ ] Validar fechas (no permitir fechas pasadas, solapamientos)

### Media Prioridad
- [ ] Generación de PDF con formato del papel original
- [ ] Dashboard con estadísticas (solicitudes por tipo, por departamento)
- [ ] Notificaciones por email
- [ ] Historial de cambios (auditoría completa)
- [ ] Búsqueda avanzada con múltiples filtros
- [ ] Exportar a Excel

### Baja Prioridad
- [ ] Calendario visual de ausencias por departamento
- [ ] Gráficas de uso de vacaciones
- [ ] Reportes mensuales/anuales
- [ ] Integración con sistema de nómina
- [ ] App móvil (React Native)

## 🤝 Contribución

1. Crear rama feature: `git checkout -b feature/nueva-funcionalidad`
2. Commit cambios: `git commit -m "feat: descripción"`
3. Push: `git push origin feature/nueva-funcionalidad`
4. Crear Pull Request

## 📄 Licencia

Propiedad de CNI (Centro Nacional de Información)

---

**Última actualización:** 2025-01-XX  
**Versión:** 1.0.0  
**Desarrollado por:** [Tu Nombre]
