# 🔄 Guía de Migración a Clean Architecture

**Versión**: 2.0  
**Fecha**: 7 de enero de 2026

---

## 📋 Checklist de Migración

### ✅ Fase 1: Infraestructura (Completada)

- [x] Crear estructura de carpetas core/
- [x] Mover schema.ts → core/infrastructure/database/
- [x] Mover rbac.ts → core/application/rbac/
- [x] Mover balance.service.ts → core/application/services/
- [x] Crear alias de compatibilidad en rutas antiguas
- [x] Actualizar tsconfig.json con nuevos paths
- [x] Documentar arquitectura (ARQUITECTURA.md)

### ⏳ Fase 2: Backend Services (Próxima - 1 semana)

**Objetivo**: Migrar todos los servicios de negocio a core/application/services

#### Tareas:

1. **Crear servicios faltantes**:
   ```
   [ ] src/core/application/services/solicitudes.service.ts
   [ ] src/core/application/services/usuarios.service.ts
   [ ] src/core/application/services/reportes.service.ts
   [ ] src/core/application/services/notificaciones.service.ts
   ```

2. **Extraer lógica de API routes**:
   - [ ] Mover validaciones de solicitudes.route.ts → solicitudes.service.ts
   - [ ] Mover lógica de aprobación → solicitudes.service.ts
   - [ ] Mover cálculos de balance → balance.service.ts (ya existe)
   - [ ] Mover gestión de usuarios → usuarios.service.ts

3. **Crear interfaces en domain/**:
   ```
   [ ] src/core/domain/interfaces/ISolicitudesRepository.ts
   [ ] src/core/domain/interfaces/IUsuariosRepository.ts
   [ ] src/core/domain/interfaces/INotificacionesService.ts
   ```

### ⏳ Fase 3: Frontend Shared (2 semanas)

**Objetivo**: Crear componentes reutilizables

#### Tareas:

1. **Componentes UI básicos**:
   ```
   [ ] src/shared/components/ui/Button.tsx
   [ ] src/shared/components/ui/Input.tsx
   [ ] src/shared/components/ui/Select.tsx
   [ ] src/shared/components/ui/Modal.tsx
   [ ] src/shared/components/ui/Table.tsx
   [ ] src/shared/components/ui/Card.tsx
   [ ] src/shared/components/ui/Badge.tsx
   [ ] src/shared/components/ui/Alert.tsx
   ```

2. **Componentes de Layout**:
   ```
   [ ] src/shared/components/layout/Navbar.tsx
   [ ] src/shared/components/layout/Sidebar.tsx
   [ ] src/shared/components/layout/Footer.tsx
   [ ] src/shared/components/layout/PageHeader.tsx
   ```

3. **Hooks compartidos**:
   ```
   [ ] src/shared/hooks/useAuth.ts
   [ ] src/shared/hooks/usePermissions.ts (integración RBAC)
   [ ] src/shared/hooks/useLocalStorage.ts
   [ ] src/shared/hooks/useDebounce.ts
   [ ] src/shared/hooks/usePagination.ts
   ```

4. **Utils**:
   ```
   [ ] src/shared/utils/formatters.ts (fechas, moneda, etc.)
   [ ] src/shared/utils/validators.ts
   [ ] src/shared/utils/constants.ts
   [ ] src/shared/utils/api.ts (helper para fetch)
   ```

### ⏳ Fase 4: Frontend Features (3 semanas)

**Objetivo**: Organizar por módulos de negocio

#### Feature 1: Solicitudes (Sprint 1)

```
src/features/solicitudes/
├── components/
│   ├── FormularioSolicitud.tsx         [mover desde src/components/]
│   ├── TablaSolicitudes.tsx            [mover desde src/components/]
│   ├── DetalleSolicitud.tsx            [crear nuevo]
│   ├── CardSolicitud.tsx               [crear nuevo]
│   └── FiltrosSolicitudes.tsx          [crear nuevo]
├── hooks/
│   ├── useSolicitudes.ts               [crear]
│   ├── useCrearSolicitud.ts            [crear]
│   └── useAprobarSolicitud.ts          [crear]
├── services/
│   └── solicitudes.api.ts              [crear - llamadas API]
├── types/
│   └── solicitud.types.ts              [extraer de types/index.ts]
└── index.ts                            [barrel export]
```

**Tareas**:
- [ ] Crear estructura de carpetas
- [ ] Mover FormularioSolicitud.tsx desde src/components/
- [ ] Mover TablaSolicitudes.tsx desde src/components/
- [ ] Crear hook useSolicitudes (fetch, create, update)
- [ ] Crear servicio solicitudes.api.ts
- [ ] Extraer tipos específicos de solicitudes
- [ ] Actualizar imports en páginas que usan estos componentes

#### Feature 2: Usuarios (Sprint 2)

```
src/features/usuarios/
├── components/
│   ├── TablaUsuarios.tsx
│   ├── FormularioUsuario.tsx
│   ├── DetalleUsuario.tsx
│   └── SelectorRoles.tsx              [nuevo - para RBAC]
├── hooks/
│   ├── useUsuarios.ts
│   ├── useCrearUsuario.ts
│   └── useAsignarRoles.ts             [nuevo - para RBAC]
├── services/
│   └── usuarios.api.ts
└── index.ts
```

**Tareas**:
- [ ] Crear estructura
- [ ] Migrar código de src/app/usuarios/UsuariosClient.tsx
- [ ] Crear SelectorRoles component para RBAC
- [ ] Crear hooks de gestión
- [ ] Integrar con sistema RBAC

#### Feature 3: Dashboard (Sprint 3)

```
src/features/dashboard/
├── components/
│   ├── DashboardLayout.tsx
│   └── widgets/
│       ├── MetricasCard.tsx
│       ├── CalendarioWidget.tsx
│       ├── ActividadReciente.tsx
│       └── BalanceWidget.tsx
├── hooks/
│   ├── useDashboardMetricas.ts
│   └── useCalendario.ts
└── services/
    └── dashboard.api.ts
```

**Tareas**:
- [ ] Crear estructura
- [ ] Crear widgets reutilizables
- [ ] Separar lógica de API routes
- [ ] Crear hooks para cada widget

#### Feature 4: Reportes (Sprint 4)

```
src/features/reportes/
├── components/
│   ├── ReporteGeneral.tsx
│   ├── ReporteDepartamento.tsx
│   ├── FiltrosReporte.tsx
│   └── ExportarReporte.tsx
├── hooks/
│   ├── useReportes.ts
│   └── useExportar.ts
├── services/
│   └── reportes.api.ts
└── utils/
    └── exportar.ts
```

### ⏳ Fase 5: Limpieza Final (1 semana)

**Objetivo**: Eliminar código deprecated

#### Tareas:

1. **Verificar imports**:
   ```bash
   # Buscar imports antiguos
   grep -r "from '@/lib/db'" src/
   grep -r "from '@/lib/rbac'" src/
   grep -r "from '@/services/'" src/
   grep -r "from '@/types'" src/
   ```

2. **Actualizar todos los imports**:
   - [ ] Actualizar imports en API routes
   - [ ] Actualizar imports en componentes
   - [ ] Actualizar imports en páginas

3. **Eliminar carpetas deprecated**:
   ```powershell
   Remove-Item src/lib/db/schema.ts
   Remove-Item src/lib/db/index.ts
   Remove-Item src/lib/rbac.ts
   Remove-Item src/services/balance.service.ts
   Remove-Item src/types/index.ts
   ```

4. **Actualizar documentación**:
   - [ ] Actualizar README.md con nueva estructura
   - [ ] Actualizar ejemplos de código
   - [ ] Crear guía de contribución con nuevas convenciones

---

## 🛠️ Cómo Migrar un Componente

### Ejemplo: Migrar FormularioSolicitud.tsx

#### Paso 1: Identificar dependencias

```typescript
// src/components/FormularioSolicitud.tsx (ANTES)
import { useState } from 'react';
import { db } from '@/lib/db';  // ← Dependencia backend
import { solicitudes } from '@/lib/db/schema';  // ← Dependencia schema
import type { NuevaSolicitud } from '@/types';  // ← Tipo
```

#### Paso 2: Crear estructura del feature

```powershell
New-Item -Path "src/features/solicitudes/components" -ItemType Directory -Force
New-Item -Path "src/features/solicitudes/hooks" -ItemType Directory -Force
New-Item -Path "src/features/solicitudes/services" -ItemType Directory -Force
New-Item -Path "src/features/solicitudes/types" -ItemType Directory -Force
```

#### Paso 3: Mover tipos

```typescript
// src/features/solicitudes/types/solicitud.types.ts (NUEVO)
export interface NuevaSolicitud {
  usuarioId: number;
  tipoAusenciaId: number;
  fechaInicio: string;
  // ... resto de campos
}
```

#### Paso 4: Crear servicio API

```typescript
// src/features/solicitudes/services/solicitudes.api.ts (NUEVO)
import type { NuevaSolicitud } from '../types/solicitud.types';

export async function crearSolicitud(data: NuevaSolicitud) {
  const response = await fetch('/api/solicitudes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error('Error al crear solicitud');
  }
  
  return response.json();
}
```

#### Paso 5: Crear hook

```typescript
// src/features/solicitudes/hooks/useCrearSolicitud.ts (NUEVO)
import { useState } from 'react';
import { crearSolicitud } from '../services/solicitudes.api';
import type { NuevaSolicitud } from '../types/solicitud.types';

export function useCrearSolicitud() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const crear = async (data: NuevaSolicitud) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await crearSolicitud(data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  return { crear, loading, error };
}
```

#### Paso 6: Actualizar componente

```typescript
// src/features/solicitudes/components/FormularioSolicitud.tsx (NUEVO)
import { useCrearSolicitud } from '../hooks/useCrearSolicitud';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';

export function FormularioSolicitud() {
  const { crear, loading, error } = useCrearSolicitud();
  
  const handleSubmit = async (data: NuevaSolicitud) => {
    await crear(data);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Formulario */}
    </form>
  );
}
```

#### Paso 7: Exportar en barrel

```typescript
// src/features/solicitudes/index.ts (NUEVO)
export * from './components/FormularioSolicitud';
export * from './components/TablaSolicitudes';
export * from './hooks/useSolicitudes';
export * from './hooks/useCrearSolicitud';
```

#### Paso 8: Actualizar imports en páginas

```typescript
// src/app/(dashboard)/solicitudes/nueva/page.tsx (ACTUALIZAR)
// ANTES:
import { FormularioSolicitud } from '@/components/FormularioSolicitud';

// DESPUÉS:
import { FormularioSolicitud } from '@/features/solicitudes';
```

---

## 🧪 Testing de la Migración

### Checklist por Feature

- [ ] Todos los imports funcionan sin errores
- [ ] Componentes renderizan correctamente
- [ ] Funcionalidad no cambió (mismo comportamiento)
- [ ] No hay warnings en consola
- [ ] TypeScript no tiene errores
- [ ] Build de producción exitoso (`npm run build`)

### Comandos de Verificación

```powershell
# Verificar errores de TypeScript
npx tsc --noEmit

# Build de producción
npm run build

# Buscar imports antiguos
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx | Select-String "from '@/lib/db'" 
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx | Select-String "from '@/lib/rbac'"
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx | Select-String "from '@/services/'"

# Verificar estructura de carpetas
Get-ChildItem -Path src -Recurse -Directory | Select-Object FullName
```

---

## 📊 Progreso de Migración

### Estado Actual (7 enero 2026)

| Fase | Estado | Progreso | Estimado |
|------|--------|----------|----------|
| 1. Infraestructura | ✅ Completada | 100% | - |
| 2. Backend Services | ⏳ Pendiente | 0% | 1 semana |
| 3. Frontend Shared | ⏳ Pendiente | 0% | 2 semanas |
| 4. Frontend Features | ⏳ Pendiente | 0% | 3 semanas |
| 5. Limpieza Final | ⏳ Pendiente | 0% | 1 semana |

**Total estimado**: 7 semanas

---

## 🚀 Próximos Pasos Inmediatos

### Esta Semana (Sprint 1)

1. **Día 1-2**: Crear solicitudes.service.ts
   - Extraer validaciones de solicitudes/route.ts
   - Crear funciones: crearSolicitud, aprobarSolicitud, rechazarSolicitud
   - Tests unitarios

2. **Día 3-4**: Crear usuarios.service.ts
   - Extraer lógica de usuarios/route.ts
   - Crear funciones: crearUsuario, actualizarUsuario, asignarRoles
   - Integración con RBAC

3. **Día 5**: Testing y documentación
   - Verificar que API routes siguen funcionando
   - Actualizar documentación de servicios
   - Code review

---

## 📚 Recursos

### Documentos de Referencia
- [ARQUITECTURA.md](./ARQUITECTURA.md) - Explicación completa de la estructura
- [INTEGRACION_RBAC_PENDIENTE.md](./INTEGRACION_RBAC_PENDIENTE.md) - Plan de integración RBAC
- [MEJORAS_IMPLEMENTADAS.md](./MEJORAS_IMPLEMENTADAS.md) - Mejoras de BD

### Ejemplos de Código
- Ver `src/core/application/rbac/rbac.service.ts` - Ejemplo de servicio bien estructurado
- Ver `src/core/application/services/balance.service.ts` - Ejemplo de lógica de negocio

---

**Autor**: Arquitecto Senior + DBA Senior  
**Versión**: 1.0  
**Última actualización**: 7 de enero de 2026
