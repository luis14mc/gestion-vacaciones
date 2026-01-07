# 🏗️ Arquitectura Clean del Proyecto

**Versión**: 2.0 - Clean Architecture  
**Fecha**: 7 de enero de 2026  
**Arquitecto**: Senior Software Engineer + DBA Senior

---

## 📐 Principios Aplicados

### 1. **Separación de Concerns**
Cada capa tiene una responsabilidad única y bien definida.

### 2. **Dependency Inversion**
Las capas internas (domain) NO dependen de las externas (infrastructure).

### 3. **Domain-Driven Design (DDD)**
El dominio del negocio está en el centro de la arquitectura.

### 4. **Feature-Based Organization**
Frontend organizado por features/módulos, no por tipo de archivo.

---

## 📁 Estructura de Carpetas

```
src/
├── core/                           # 🔵 Lógica de negocio (Backend)
│   ├── domain/                     # Capa de Dominio
│   │   ├── entities/               # Entidades y tipos del dominio
│   │   │   ├── types.ts           # Tipos TypeScript centralizados
│   │   │   └── index.ts
│   │   └── interfaces/             # Contratos e interfaces
│   │
│   ├── application/                # Capa de Aplicación
│   │   ├── rbac/                   # Sistema de permisos
│   │   │   ├── rbac.service.ts    # Lógica RBAC
│   │   │   └── index.ts
│   │   ├── auditoria/              # Sistema de auditoría
│   │   │   ├── auditoria.service.ts
│   │   │   └── index.ts
│   │   └── services/               # Servicios de negocio
│   │       ├── balance.service.ts
│   │       ├── solicitudes.service.ts  # 🔜 Próximamente
│   │       ├── usuarios.service.ts     # 🔜 Próximamente
│   │       └── index.ts
│   │
│   └── infrastructure/             # Capa de Infraestructura
│       └── database/               # Acceso a datos
│           ├── schema.ts           # Drizzle ORM schema
│           ├── client.ts           # Cliente de BD
│           └── index.ts
│
├── features/                       # 🟢 Módulos de negocio (Frontend)
│   ├── solicitudes/                # Feature: Gestión de solicitudes
│   │   ├── components/
│   │   │   ├── FormularioSolicitud.tsx
│   │   │   ├── TablaSolicitudes.tsx
│   │   │   └── DetalleSolicitud.tsx
│   │   ├── hooks/
│   │   │   ├── useSolicitudes.ts
│   │   │   └── useAprobarSolicitud.ts
│   │   ├── services/
│   │   │   └── solicitudes.api.ts
│   │   └── types/
│   │       └── solicitud.types.ts
│   │
│   ├── usuarios/                   # Feature: Gestión de usuarios
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   │
│   ├── dashboard/                  # Feature: Dashboard
│   │   ├── components/
│   │   ├── hooks/
│   │   └── widgets/
│   │
│   └── [otros módulos]/
│
├── shared/                         # 🟡 Código compartido
│   ├── components/                 # Componentes reutilizables
│   │   ├── ui/                    # Componentes UI básicos
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Table.tsx
│   │   └── layout/                # Componentes de layout
│   │       ├── Navbar.tsx
│   │       ├── Sidebar.tsx
│   │       └── Footer.tsx
│   │
│   ├── hooks/                      # Hooks reutilizables
│   │   ├── useAuth.ts
│   │   ├── usePermissions.ts       # 🔜 Próximamente
│   │   └── useLocalStorage.ts
│   │
│   ├── utils/                      # Utilidades
│   │   ├── formatters.ts          # Formateo de datos
│   │   ├── validators.ts          # Validaciones
│   │   └── constants.ts           # Constantes globales
│   │
│   └── types/                      # Tipos compartidos
│       └── api.types.ts
│
├── app/                            # 🔴 Next.js App Router
│   ├── (auth)/                    # Grupo de rutas públicas
│   │   └── login/
│   │
│   ├── (dashboard)/               # Grupo de rutas privadas
│   │   ├── dashboard/
│   │   ├── solicitudes/
│   │   └── usuarios/
│   │
│   ├── api/                       # API Routes
│   │   ├── auth/
│   │   ├── solicitudes/
│   │   └── usuarios/
│   │
│   ├── layout.tsx
│   └── page.tsx
│
├── lib/                            # 🟠 Compatibilidad (DEPRECATED)
│   ├── db/
│   │   ├── index.ts               # ⚠️ Alias → @/core/infrastructure/database
│   │   └── schema.ts              # ⚠️ Alias → @/core/infrastructure/database
│   └── rbac.ts                    # ⚠️ Alias → @/core/application/rbac
│
├── components/                     # 🟠 Compatibilidad (DEPRECATED)
│   └── [archivos antiguos]        # ⚠️ Mover a shared/components o features/
│
├── services/                       # 🟠 Compatibilidad (DEPRECATED)
│   └── balance.service.ts         # ⚠️ Alias → @/core/application/services
│
├── types/                          # 🟠 Compatibilidad (DEPRECATED)
│   └── index.ts                   # ⚠️ Alias → @/core/domain/entities
│
├── auth.ts                        # Configuración NextAuth
└── middleware.ts                  # Middleware global
```

---

## 🎯 Capas de la Arquitectura

### 🔵 CORE - Lógica de Negocio

#### 1. **Domain Layer** (Capa de Dominio)
- **Responsabilidad**: Entidades, reglas de negocio, interfaces
- **Dependencias**: NINGUNA (capa más interna)
- **Contenido**:
  - `entities/`: Tipos TypeScript, interfaces del dominio
  - `interfaces/`: Contratos que debe cumplir infrastructure

**Ejemplo**:
```typescript
// src/core/domain/entities/types.ts
export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  roles: Rol[];
}

export interface Rol {
  id: number;
  codigo: string;
  permisos: Permiso[];
}
```

#### 2. **Application Layer** (Capa de Aplicación)
- **Responsabilidad**: Casos de uso, servicios de aplicación
- **Dependencias**: Domain layer
- **Contenido**:
  - `rbac/`: Lógica de permisos y autorización
  - `auditoria/`: Registro de eventos
  - `services/`: Servicios de negocio (balance, notificaciones, etc.)

**Ejemplo**:
```typescript
// src/core/application/rbac/rbac.service.ts
export async function usuarioTienePermiso(
  usuarioId: number,
  permiso: string
): Promise<ValidacionPermiso> {
  // Lógica de negocio pura
}
```

#### 3. **Infrastructure Layer** (Capa de Infraestructura)
- **Responsabilidad**: Acceso a datos, APIs externas, BD
- **Dependencias**: Domain + Application layers
- **Contenido**:
  - `database/`: Drizzle ORM, schemas, cliente BD

**Ejemplo**:
```typescript
// src/core/infrastructure/database/client.ts
export const db = drizzle(sql, { schema });
```

---

### 🟢 FEATURES - Módulos de Frontend

Organización **por característica** (feature-based), no por tipo de archivo.

#### Estructura de un Feature:
```
features/solicitudes/
├── components/           # Componentes específicos del feature
│   ├── FormularioSolicitud.tsx
│   └── TablaSolicitudes.tsx
├── hooks/               # Hooks personalizados
│   ├── useSolicitudes.ts
│   └── useAprobarSolicitud.ts
├── services/            # Llamadas API
│   └── solicitudes.api.ts
├── types/               # Tipos específicos
│   └── solicitud.types.ts
└── index.ts             # Barrel export
```

**Ventajas**:
- ✅ Todo lo relacionado con "solicitudes" está en un solo lugar
- ✅ Fácil de encontrar y mantener
- ✅ Fácil de eliminar (borra la carpeta completa)
- ✅ Reutilización explícita (si algo se usa en 2+ features → shared/)

---

### 🟡 SHARED - Código Compartido

Todo lo que se usa en 2+ features.

#### Categorías:

**1. UI Components**:
```typescript
// shared/components/ui/Button.tsx
export function Button({ variant, children, ...props }) {
  // Componente reutilizable
}
```

**2. Hooks**:
```typescript
// shared/hooks/useAuth.ts
export function useAuth() {
  const session = useSession();
  return { user: session?.user, isAuthenticated: !!session };
}
```

**3. Utils**:
```typescript
// shared/utils/formatters.ts
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO'
  }).format(amount);
}
```

---

## 📦 Convenciones de Imports

### Alias de Path (@/)

Configurados en `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/core/*": ["./src/core/*"],
      "@/features/*": ["./src/features/*"],
      "@/shared/*": ["./src/shared/*"],
      "@/app/*": ["./src/app/*"],
      "@/*": ["./src/*"]
    }
  }
}
```

### Orden de Imports (Recomendado)

```typescript
// 1. Externos
import React from 'react';
import { NextRequest } from 'next/server';

// 2. Core (backend logic)
import { db } from '@/core/infrastructure/database';
import { usuarioTienePermiso } from '@/core/application/rbac';
import type { Usuario } from '@/core/domain/entities';

// 3. Features (frontend modules)
import { FormularioSolicitud } from '@/features/solicitudes/components';
import { useSolicitudes } from '@/features/solicitudes/hooks';

// 4. Shared (utilities)
import { Button } from '@/shared/components/ui';
import { useAuth } from '@/shared/hooks';
import { formatDate } from '@/shared/utils';

// 5. Relativos (mismo feature)
import { SolicitudCard } from './SolicitudCard';
```

---

## 🔄 Migración Gradual

### Fase Actual: **Compatibilidad**

Se mantienen alias en las rutas antiguas:

```typescript
// ⚠️ DEPRECATED (pero funciona)
import { db } from '@/lib/db';
import { usuarioTienePermiso } from '@/lib/rbac';

// ✅ RECOMENDADO (nueva ruta)
import { db } from '@/core/infrastructure/database';
import { usuarioTienePermiso } from '@/core/application/rbac';
```

### Plan de Migración:

**Sprint 1-2** (Actual):
- ✅ Crear nueva estructura
- ✅ Copiar archivos a nuevas ubicaciones
- ✅ Mantener alias de compatibilidad
- ⏳ Actualizar imports en nuevos archivos

**Sprint 3-4** (Próximo mes):
- [ ] Migrar todos los imports a nuevas rutas
- [ ] Eliminar carpetas `lib/`, `services/`, `types/` originales
- [ ] Migrar componentes a `shared/` o `features/`

**Sprint 5-6** (Mes 2):
- [ ] Reorganizar frontend por features
- [ ] Crear estructura de features para:
  * `features/solicitudes/`
  * `features/usuarios/`
  * `features/dashboard/`
  * `features/reportes/`
- [ ] Mover componentes específicos de cada feature

---

## 🎯 Beneficios de esta Arquitectura

### 1. **Escalabilidad**
- Fácil agregar nuevos módulos sin afectar existentes
- Crecimiento horizontal (nuevos features) y vertical (nuevas capas)

### 2. **Mantenibilidad**
- Código organizado por dominio, no por tipo
- Fácil encontrar funcionalidad relacionada
- Cambios aislados en un solo lugar

### 3. **Testabilidad**
- Capas desacopladas facilitan unit testing
- Mocks claros (interfaces en domain)
- Tests de integración simples

### 4. **Onboarding**
- Nuevos developers entienden estructura rápido
- Convenciones claras y documentadas
- Ejemplos consistentes

### 5. **Performance**
- Imports específicos (tree-shaking óptimo)
- Código compartido en shared/
- Lazy loading por feature

---

## 📚 Referencias y Estándares

### Arquitectura Clean
- Robert C. Martin - "Clean Architecture"
- Ports & Adapters (Hexagonal Architecture)
- Domain-Driven Design (Eric Evans)

### Next.js Best Practices
- App Router structure
- Server/Client Components separation
- API Routes organization

### TypeScript Patterns
- Barrel exports (index.ts)
- Path aliases
- Strict mode enabled

---

## 🚀 Próximos Pasos

### Inmediatos (Esta semana)
1. ✅ Crear estructura core/
2. ✅ Mover archivos principales
3. ✅ Crear alias de compatibilidad
4. ⏳ Documentar arquitectura

### Corto plazo (2 semanas)
1. [ ] Crear helper de autorización en core/application
2. [ ] Migrar balance.service a core/application/services
3. [ ] Crear features/solicitudes/
4. [ ] Mover FormularioSolicitud y TablaSolicitudes

### Mediano plazo (1 mes)
1. [ ] Completar migración de imports
2. [ ] Eliminar carpetas deprecated
3. [ ] Crear todos los features principales
4. [ ] Testing de la nueva estructura

---

**Autor**: Arquitecto Senior + DBA Senior  
**Versión**: 2.0.0  
**Última actualización**: 7 de enero de 2026
