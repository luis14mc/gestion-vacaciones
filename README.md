# Sistema de Gestión de Vacaciones y Permisos - CNI

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue?logo=postgresql)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-0.44-green)](https://orm.drizzle.team/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.1-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

Sistema web integral para la gestión de solicitudes de vacaciones, permisos y licencias laborales del Consejo Nacional de Inversiones (CNI), Honduras.

---

## Stack Tecnológico

| Categoría | Tecnología | Versión |
|-----------|-----------|---------|
| Framework | Next.js (App Router) | 16.0.3 |
| Lenguaje | TypeScript | 5.9.3 |
| Base de Datos | PostgreSQL | 16+ |
| ORM | Drizzle ORM | 0.44.7 |
| DB Client | postgres (pg-native) | 3.4.8 |
| Autenticación | NextAuth.js v5 (beta) | 5.0.0-beta.30 |
| UI | TailwindCSS + Radix UI | 4.1.17 |
| Formularios | React Hook Form + Zod | 7.71 / 4.3 |
| Data Fetching | TanStack React Query | 5.90 |
| Reportes | ExcelJS + jsPDF | 4.4 / 4.0 |
| Alertas | SweetAlert2 | 11.26 |
| Íconos | Lucide React | 0.554 |
| Testing | Vitest + Testing Library | 4.0 |
| Package Manager | pnpm | Latest |

---

## Estructura del Proyecto

```
gestion-vacaciones/
├── scripts/
│   ├── install-database.mjs          # Instalación automática de BD
│   └── seed-database.ts              # Seed: roles, permisos, usuarios, balances
│
├── src/
│   ├── auth.ts                       # Configuración NextAuth (JWT, callbacks)
│   ├── middleware.ts                 # Protección de rutas (auth check)
│   │
│   ├── lib/
│   │   ├── auth.ts                   # getSession(), tienePermiso(), helpers RBAC
│   │   ├── utils.ts                  # cn() y utilidades generales
│   │   ├── swal.ts                   # Configuración SweetAlert2
│   │   ├── pdfExport.ts              # Generación de reportes PDF
│   │   ├── db/
│   │   │   ├── index.ts              # Cliente Drizzle + conexión PostgreSQL
│   │   │   └── schema/
│   │   │       ├── index.ts          # Barrel export de schemas
│   │   │       ├── auth.ts           # usuarios, roles, permisos, usuarios_roles
│   │   │       ├── organizacion.ts   # departamentos, configuración, auditoría
│   │   │       ├── solicitudes.ts    # solicitudes, enums de estado/tipo
│   │   │       └── balances.ts       # balances, años_laborales, movimientos
│   │   ├── domain/
│   │   │   └── state-machine.ts      # Máquina de estados del workflow (Jefe -> RRHH)
│   │   ├── schemas/                  # Schemas Zod de validación
│   │   └── validations/              # Validaciones de formularios
│   │
│   ├── services/
│   │   ├── index.ts                  # Barrel export
│   │   ├── solicitudes.service.ts    # CRUD solicitudes, rechazo, cancelación
│   │   ├── usuarios.service.ts       # CRUD usuarios, asignación de roles
│   │   ├── workflow.service.ts       # Transiciones de estado, balance de días
│   │   ├── rbac.service.ts           # Roles, permisos, verificaciones RBAC
│   │   └── excel.service.ts          # Exportación de reportes Excel
│   │
│   ├── types/
│   │   └── index.ts                  # Interfaces TypeScript del sistema
│   │
│   ├── providers/                    # Context providers (SessionProvider, QueryProvider)
│   ├── hooks/                        # Custom hooks (useBalances, useTiposAusencia, etc.)
│   │
│   ├── components/
│   │   ├── AuthProvider.tsx          # Provider de sesión NextAuth
│   │   ├── FormularioSolicitud.tsx   # Formulario principal de solicitudes
│   │   ├── layout/
│   │   │   └── AppShell.tsx          # Layout con sidebar y navegación
│   │   ├── dashboard/
│   │   │   ├── MetricCard.tsx        # Tarjeta de métrica
│   │   │   ├── CalendarView.tsx      # Vista de calendario
│   │   │   ├── ActivityFeed.tsx      # Feed de actividad reciente
│   │   │   └── QuickActions.tsx      # Acciones rápidas
│   │   ├── solicitudes/
│   │   │   ├── BalanceViewer.tsx     # Visualizador de balance de días
│   │   │   ├── VacacionesSection.tsx # Sección vacaciones del formulario
│   │   │   └── PermisoHorasSection.tsx # Sección permisos de horas
│   │   └── ui/                       # Componentes UI base (Radix/shadcn)
│   │
│   └── app/
│       ├── layout.tsx                # Root layout
│       ├── page.tsx                  # Página raíz (redirect)
│       ├── globals.css               # Estilos globales (Tailwind)
│       ├── login/page.tsx            # Login
│       ├── dashboard/page.tsx        # Dashboard principal segmentado por roles
│       ├── solicitudes/
│       │   ├── page.tsx              # Lista de solicitudes y estado
│       │   └── nueva/page.tsx        # Nueva solicitud dinámica
│       ├── aprobar-solicitudes/page.tsx  # Aprobación (Nivel 1 Jefe, Nivel 2 RRHH)
│       ├── usuarios/page.tsx         # Gestión de usuarios
│       ├── mi-perfil/page.tsx        # Perfil personal
│       ├── mi-equipo/page.tsx        # Equipo del jefe
│       ├── asignacion-dias/page.tsx  # Asignación masiva y automática de días
│       ├── reportes/page.tsx         # Reportes generales
│       ├── reportes-departamento/page.tsx # Reportes por departamento
│       ├── exportar/page.tsx         # Exportar datos a Excel y JSON
│       ├── configuracion/page.tsx    # Configuración del sistema
│       ├── auditoria/page.tsx        # Log de auditoría del sistema
│       └── api/                      # API REST interna (rutas)
│
├── tests/
│   ├── setup.ts                      # Setup Vitest
│   ├── helpers/test-data.ts          # Helpers de datos de prueba
│   ├── unit/                         # Tests unitarios de servicios y máquina de estados
│   └── integration/                  # Tests de integración e interconexión
│
├── drizzle.config.ts                 # Configuración Drizzle Kit
├── vitest.config.ts                  # Configuración Vitest
├── package.json
├── tsconfig.json
└── .env.local                        # Variables de entorno (no versionado)
```

---

## Autenticación y Autorización (RBAC)

### Arquitectura

El sistema usa **NextAuth.js v5** con **Credentials Provider** y un modelo RBAC estructurado:

```
NextAuth (JWT) → getSession() → SessionUser { id, roles[], permisos[], esAdmin, esRrhh, esJefe, esDirector }
```

- `src/auth.ts` configura NextAuth (JWT callbacks, session callbacks).
- `src/lib/auth.ts` provee `getSession()` que enriquece la sesión leyendo flags actualizados en tiempo real desde la BD.
- `src/middleware.ts` protege todas las rutas verificando una sesión activa.
- Cada API route verifica permisos específicos a nivel de endpoint empleando `tienePermiso(session, 'permiso.codigo')`.

### Roles y Jerarquía

| Rol | Código | Nivel | Descripción |
|-----|--------|-------|-------------|
| Administrador | `ADMIN` | 10 | Acceso total al sistema. Bypass implícito de permisos restrictivos. |
| Recursos Humanos | `RRHH` | 8 | Gestión completa de solicitudes, reportes, usuarios y balances. Nivel 2 de Aprobación. |
| Secretario General / Director | `DIRECTOR` | 7 | Vista alta jerarquía, aprobación ejecutiva cuando es necesario. |
| Jefe de Departamento | `JEFE` | 5 | Aprobación Nivel 1. Vista exclusiva y reportes de su departamento. |
| Empleado | `EMPLEADO` | 1 | Solicitudes propias, vista personal de su balance del Año Laboral Activo. |

---

## Base de Datos

### Schema (Drizzle ORM)

| Archivo | Tablas | Contenido |
|---------|--------|-----------|
| `auth.ts` | `usuarios`, `roles`, `permisos`, `rolesPermisos`, `usuariosRoles` | Autenticación y motor RBAC dinámico |
| `organizacion.ts` | `departamentos`, `usuariosDepartamentos`, `configuracion`, `auditoria` | Estructura organizacional y configuración maestra |
| `solicitudes.ts` | `solicitudes` | Solicitudes de ausencia con workflow multi-nivel y auditoría de flujo |
| `balances.ts` | `anosLaborales`, `balances`, `movimientosBalance` | Control de días disponibles asociados al código de trabajo |

---

## Workflow y Automatizaciones

### 1. Máquina de Estados (Solicitudes)

El ciclo de vida de una solicitud ha sido reforzado para funcionar con aprobaciones escalonadas definidas en `src/lib/domain/state-machine.ts`:

1. El Empleado crea una solicitud (`borrador` -> `pendiente_jefe`).
2. El Jefe de Departamento la evalúa. Si la aprueba pasa a `aprobada_jefe` (mostrada visualmente como *Pendiente RRHH* para el empleado).
3. RRHH la recibe. Si la valida (y corrobora adjuntos en caso de licencias médicas), pasa a `aprobada_rrhh` o `finalizada`.
4. El balance del empleado no se descuenta para "Permisos de Salida" por horas, pero sí para "Vacaciones" y "Licencias Médicas" completas.

### 2. Automatización de Días de Vacaciones

El administrador de RRHH tiene la capacidad de correr scripts automáticos desde la interfaz de usuario (`/api/admin/asignar-dias`). Esta función calcula **según la tabla del Código de Trabajo (artículo de antigüedad)**, cuántos días corresponden a cada empleado con base en su `fechaIngreso` y deposita estos saldos en el `anoLaboral` marcado como activo en la base de datos.

### 3. Filtros y Licencias Médicas
El frontend restringe orgánicamente los tipos de ausencia presentados a los empleados a: Vacaciones, Permiso de Salida, y Licencia Médica. Esta última hace **obligatorio** la adjunción de un archivo que certifique la ausencia por motivos de salud.

---

## Instalación y Despliegue

### Requisitos

- Node.js 18+ (Preferible Node 20+)
- PostgreSQL 16+
- Gestor de paquetes `pnpm`

### Configuración de Entorno

```bash
# 1. Clonar e instalar dependencias
git clone <repo-url>
cd gestion-vacaciones
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env.local
```

### Variables de Entorno Clave (`.env.local`)

```env
DATABASE_URL="postgresql://usuario:password@host:5432/vacaciones?sslmode=require"
NEXTAUTH_SECRET="tu-secreto-seguro"
NEXTAUTH_URL="http://localhost:3000"
SMTP_HOST="smtp.office365.com"  # (Configuración futura de notificaciones si aplica)
```

### Base de Datos y Seed

```bash
# Instalación y push directo del schema con Drizzle
pnpm db:push

# Poblar la base de datos con roles, años laborales y departamentos base
pnpm db:seed
```

### Ejecutar el Proyecto

```bash
# Servidor de Desarrollo
pnpm dev

# Compilar para Producción
pnpm build
pnpm start
```

---

## Seguridad y Optimización

- **Protección JWT:** Autenticación por NextAuth.js con cookies seguras e HttpOnly.
- **RBAC Estricto:** Permisos granulares y jerárquicos verificados de lado del servidor en CADA ruta de la API.
- **Integridad Transaccional:** Control estricto de concurrencia y validaciones cruzadas entre `solicitudes` y `balances`.
- **Prevención de Inyección:** Utilización intrínseca de query params y prepared statements a través de **Drizzle ORM**.
- **Refresco Dinámico React Query:** Caching inteligente minimizando cargas de base de datos a la vez que actualiza saldos tras cada acción ejecutada.

---

## Licencia y Créditos

Proyecto desarrollado y mantenido como propiedad intelectual exclusiva del **Consejo Nacional de Inversiones (CNI) - Honduras, 2026**.

**Versión**: 1.1.0  
**Última actualización**: Mayo 2026
