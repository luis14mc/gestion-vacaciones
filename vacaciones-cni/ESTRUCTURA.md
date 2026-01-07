# 📊 Estructura del Proyecto - Clean Architecture v2.0

**Última actualización**: 7 de enero de 2026  
**Versión**: 2.0.0

---

## 📁 Árbol de Directorios

```
vacaciones-cni/
├── 📂 migrations/                       # SQL migrations
│   └── 001_schema_improvements.sql     # RBAC + FKs + Optimizaciones
│
├── 📂 scripts/                          # Scripts de automatización
│   ├── migrate.js                      # Ejecutor de migraciones
│   ├── seed-usuarios.js               # Seed data
│   ├── seed-departamentos.ts
│   └── seed-configuraciones.ts
│
├── 📂 database/                         # Scripts SQL iniciales
│   ├── 01_tipos_enums.sql
│   ├── 02_tablas_principales.sql
│   ├── 03_balances_solicitudes.sql
│   ├── 04_vistas_funciones.sql
│   ├── 05_datos_iniciales.sql
│   └── README.md
│
├── 📂 src/                             # Código fuente
│   │
│   ├── 📂 core/                        # 🔵 BACKEND - Lógica de Negocio
│   │   ├── 📂 domain/                  # Capa de Dominio
│   │   │   ├── entities/
│   │   │   │   ├── types.ts           # ✅ Tipos TypeScript
│   │   │   │   └── index.ts
│   │   │   └── interfaces/            # Contratos
│   │   │
│   │   ├── 📂 application/             # Capa de Aplicación
│   │   │   ├── rbac/
│   │   │   │   ├── rbac.service.ts    # ✅ Sistema RBAC
│   │   │   │   └── index.ts
│   │   │   ├── auditoria/
│   │   │   │   ├── auditoria.service.ts # ✅ Auditoría
│   │   │   │   └── index.ts
│   │   │   └── services/
│   │   │       ├── balance.service.ts  # ✅ Lógica de balances
│   │   │       └── index.ts
│   │   │
│   │   └── 📂 infrastructure/          # Capa de Infraestructura
│   │       └── database/
│   │           ├── schema.ts          # ✅ Drizzle schema
│   │           ├── client.ts          # ✅ Cliente BD
│   │           └── index.ts
│   │
│   ├── 📂 features/                    # 🟢 FRONTEND - Módulos
│   │   └── (preparado para migración)
│   │
│   ├── 📂 shared/                      # 🟡 Código Compartido
│   │   ├── components/
│   │   │   ├── ui/                    # Componentes básicos
│   │   │   └── layout/                # Layout components
│   │   ├── hooks/                     # Hooks reutilizables
│   │   └── utils/                     # Utilidades
│   │
│   ├── 📂 app/                         # Next.js App Router
│   │   ├── (auth)/
│   │   │   └── login/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── solicitudes/
│   │   │   ├── usuarios/
│   │   │   ├── reportes/
│   │   │   └── configuracion/
│   │   ├── api/                       # API Routes
│   │   │   ├── auth/
│   │   │   ├── solicitudes/
│   │   │   ├── usuarios/
│   │   │   ├── balances/
│   │   │   ├── dashboard/
│   │   │   ├── reportes/
│   │   │   └── ...
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   │
│   ├── 📂 components/                  # ⚠️ DEPRECATED
│   │   ├── AuthProvider.tsx          # Migrar a shared/
│   │   ├── FormularioSolicitud.tsx   # Migrar a features/solicitudes
│   │   ├── TablaSolicitudes.tsx      # Migrar a features/solicitudes
│   │   └── LogoutButton.tsx          # Migrar a shared/
│   │
│   ├── 📂 lib/                         # ⚠️ DEPRECATED (Alias de compatibilidad)
│   │   ├── db/
│   │   │   ├── index.ts              # → @/core/infrastructure/database
│   │   │   └── schema.ts             # → @/core/infrastructure/database
│   │   ├── rbac.ts                   # → @/core/application/rbac
│   │   └── auditoria.ts              # → @/core/application/auditoria
│   │
│   ├── 📂 services/                    # ⚠️ DEPRECATED
│   │   └── balance.service.ts        # → @/core/application/services
│   │
│   ├── 📂 types/                       # ⚠️ DEPRECATED
│   │   └── index.ts                  # → @/core/domain/entities
│   │
│   ├── auth.ts                        # NextAuth config
│   └── middleware.ts                  # Middleware global
│
├── 📂 public/                          # Assets estáticos
│
├── 📄 ARQUITECTURA.md                  # ✅ Documentación arquitectura
├── 📄 GUIA_MIGRACION.md               # ✅ Guía de migración
├── 📄 INTEGRACION_RBAC_PENDIENTE.md   # ✅ Plan integración RBAC
├── 📄 MEJORAS_IMPLEMENTADAS.md        # ✅ Mejoras de BD
├── 📄 RESUMEN_FINAL.md                # ✅ Resumen ejecutivo
├── 📄 ANALISIS_BD_SENIOR.md           # ✅ Análisis de BD
├── 📄 README.md                       # ✅ Documentación principal
│
├── 📄 package.json
├── 📄 tsconfig.json                   # ✅ Paths actualizados
├── 📄 next.config.mjs
├── 📄 tailwind.config.ts
├── 📄 postcss.config.js
├── 📄 drizzle.config.ts
└── 📄 .env.local

```

---

## 🎯 Capas de la Arquitectura

### 🔵 **CORE** - Backend (Lógica de Negocio)

```
core/
├── domain/          → Entidades, tipos, interfaces
├── application/     → Servicios, casos de uso
└── infrastructure/  → BD, APIs externas
```

**Estado**: ✅ **Implementada**  
**Archivos**: 6 archivos principales migrados

### 🟢 **FEATURES** - Frontend (Módulos)

```
features/
├── solicitudes/     → Todo sobre solicitudes
├── usuarios/        → Todo sobre usuarios
├── dashboard/       → Todo sobre dashboard
└── reportes/        → Todo sobre reportes
```

**Estado**: ⏳ **Pendiente** (Fase 2)  
**Próximo sprint**: Crear estructura + migrar componentes

### 🟡 **SHARED** - Código Compartido

```
shared/
├── components/      → UI reutilizables
├── hooks/           → Hooks compartidos
└── utils/           → Utilidades
```

**Estado**: ⏳ **Pendiente** (Fase 3)

---

## ✅ Cambios Implementados

### 1. **Archivos Eliminados**
- ❌ `src/lib/db/schema.backup.ts` - Archivo backup obsoleto
- ❌ `src/lib/db/migrations/` - Duplicado (migraciones están en `/migrations`)

### 2. **Archivos Movidos**

| Origen | Destino | Estado |
|--------|---------|--------|
| `src/lib/db/schema.ts` | `src/core/infrastructure/database/schema.ts` | ✅ |
| `src/lib/db/index.ts` | `src/core/infrastructure/database/client.ts` | ✅ |
| `src/lib/rbac.ts` | `src/core/application/rbac/rbac.service.ts` | ✅ |
| `src/lib/auditoria.ts` | `src/core/application/auditoria/auditoria.service.ts` | ✅ |
| `src/services/balance.service.ts` | `src/core/application/services/balance.service.ts` | ✅ |
| `src/types/index.ts` | `src/core/domain/entities/types.ts` | ✅ |

### 3. **Aliases de Compatibilidad Creados**

Los archivos antiguos ahora son **wrappers** que importan de las nuevas ubicaciones:

```typescript
// src/lib/db/index.ts (ACTUAL)
export * from '@/core/infrastructure/database';
```

Esto permite que el código existente siga funcionando mientras se migra gradualmente.

### 4. **tsconfig.json Actualizado**

Nuevos paths agregados:

```json
{
  "paths": {
    "@/core/*": ["./src/core/*"],          // 🆕
    "@/features/*": ["./src/features/*"],  // 🆕
    "@/shared/*": ["./src/shared/*"],      // 🆕
    "@/app/*": ["./src/app/*"],            // 🆕
    "@/*": ["./src/*"]
  }
}
```

### 5. **Documentación Creada**

- ✅ `ARQUITECTURA.md` - Explicación completa (800+ líneas)
- ✅ `GUIA_MIGRACION.md` - Guía paso a paso (600+ líneas)
- ✅ `ESTRUCTURA.md` - Este archivo

---

## 🔄 Estado de Migración

### Progreso General: **15%**

| Fase | Estado | Progreso |
|------|--------|----------|
| 1. Infraestructura Backend | ✅ Completada | 100% |
| 2. Services Backend | ⏳ Pendiente | 0% |
| 3. Shared Components | ⏳ Pendiente | 0% |
| 4. Features Frontend | ⏳ Pendiente | 0% |
| 5. Limpieza Final | ⏳ Pendiente | 0% |

---

## 🚀 Próximos Pasos

### Esta Semana
1. ✅ Estructura core/ creada
2. ✅ Archivos migrados
3. ✅ Documentación completa
4. ⏳ Crear primer servicio (solicitudes.service.ts)
5. ⏳ Comenzar migración de componentes

### Siguiente Sprint
- Crear `features/solicitudes/`
- Mover FormularioSolicitud + TablaSolicitudes
- Crear hooks de solicitudes
- Crear servicio API

---

## 📚 Documentos Relacionados

- [ARQUITECTURA.md](./ARQUITECTURA.md) - Arquitectura clean completa
- [GUIA_MIGRACION.md](./GUIA_MIGRACION.md) - Cómo migrar código
- [INTEGRACION_RBAC_PENDIENTE.md](./INTEGRACION_RBAC_PENDIENTE.md) - Plan RBAC
- [README.md](./README.md) - Documentación principal

---

**Compilación**: ✅ Exitosa  
**Tests**: ⏳ Pendiente  
**Producción**: ⚠️ Requiere migración completa

---

*Generado automáticamente por el sistema de arquitectura clean v2.0*
