# 📋 SEMANA 3 - Testing de Integración + Frontend Refactor + Workflows Completos

**Sistema de Gestión de Vacaciones - CNI Honduras**  
**Fecha**: 5-9 de febrero de 2026 (Miércoles-Domingo)  
**Prioridad**: 🔴 CRÍTICA  
**Duración estimada**: 40 horas (5 días laborales)

---

## 🎯 Objetivo Principal

Completar la **validación integral del sistema** mediante tests de integración, refactorizar componentes frontend para reutilización, implementar flujos completos de aprobación y preparar funcionalidades de exportación/calendario para deployment.

**Base completada (Semana 2)**:
- ✅ 4 servicios de negocio (~2,300 líneas)
- ✅ Base de datos atómica (5 SQL + 7 módulos schema)
- ✅ 60 tests unitarios passing
- ✅ Build + validación exitosa

**Objetivo Semana 3**: Llevar el sistema del **45% → 75%** de completitud

---

## 📊 Métricas de Éxito

| Métrica | Antes (S2) | Después (S3) | Mejora |
|---------|------------|--------------|--------|
| Test coverage total | 48% | >80% | +67% |
| Tests de integración | 0 | 20+ | ∞ |
| Componentes reutilizables | 5 | 15+ | +200% |
| Workflows completos | 2 | 4 | +100% |
| Funcionalidades listas | 65% | 85% | +20% |
| Bugs críticos | 8 | 0 | -100% |

---

## 📅 DÍA 1 (Miércoles 05/02) - Tests de Integración (Backend)

### 🎯 Objetivo
Validar que los servicios funcionan correctamente con la base de datos real, transacciones se ejecutan bien y no hay side effects.

### ✅ Tareas

#### **1.1 Configurar entorno de tests de integración** (1.5h)
- [ ] Crear base de datos de testing PostgreSQL:
  ```bash
  createdb vacaciones_cni_test
  ```
- [ ] Configurar `.env.test` con variables de entorno separadas:
  ```env
  DATABASE_URL=postgresql://user:pass@localhost:5432/vacaciones_cni_test
  NODE_ENV=test
  ```
- [ ] Actualizar `vitest.config.ts` para incluir setup/teardown:
  ```typescript
  export default defineConfig({
    test: {
      environment: 'node',
      setupFiles: ['./tests/setup-integration.ts'],
      pool: 'forks', // Para transacciones aisladas
    }
  });
  ```
- [ ] Crear `tests/setup-integration.ts`:
  - Función `beforeAll`: Ejecutar migraciones en BD test
  - Función `afterEach`: Limpiar datos de prueba
  - Función `afterAll`: Cerrar conexiones
- [ ] Commit: `test(integration): Configurar entorno de tests de integración`

#### **1.2 Tests de integración - solicitudes.service** (3h)
Crear `tests/integration/solicitudes.service.integration.test.ts`

**Tests a implementar:**
- [ ] `crearSolicitud()`:
  * ✅ Crea solicitud con código SOL-2026-XXXXX
  * ✅ Actualiza balance.cantidadPendiente
  * ✅ Rechaza si balance insuficiente
  * ✅ Valida fechas (inicio < fin)
  * ✅ Rollback en error (transacción)

- [ ] `aprobarSolicitudJefe()`:
  * ✅ Cambia estado a 'aprobada_jefe'
  * ✅ Incrementa campo 'version'
  * ✅ Rechaza si jefe no es del mismo departamento (403)
  * ✅ Rechaza si estado no es 'pendiente' (400)
  * ✅ Optimistic locking: detecta lost updates

- [ ] `aprobarSolicitudRRHH()`:
  * ✅ Cambia estado a 'aprobada'
  * ✅ Mueve días: pendiente → utilizada en balance
  * ✅ Rechaza si estado no es 'aprobada_jefe' (400)

- [ ] `rechazarSolicitud()`:
  * ✅ Cambia estado a 'rechazada'
  * ✅ Devuelve días a balance.cantidadDisponible
  * ✅ Registra motivo de rechazo

**Coverage esperado**: >85%  
**Commit**: `test(integration): Tests de integración solicitudes.service`

#### **1.3 Tests de integración - usuarios.service** (2.5h)
Crear `tests/integration/usuarios.service.integration.test.ts`

**Tests a implementar:**
- [ ] `crearUsuario()`:
  * ✅ Crea usuario con password hasheado (bcrypt)
  * ✅ Asigna rol EMPLEADO por defecto
  * ✅ Crea balances iniciales para año actual
  * ✅ Rechaza email duplicado (409)
  * ✅ Valida formato de email

- [ ] `actualizarUsuario()`:
  * ✅ Actualiza campos permitidos
  * ✅ Preserva password si no se envía
  * ✅ Incrementa version (optimistic locking)
  * ✅ Rechaza si version no coincide (409)

- [ ] `desactivarUsuario()`:
  * ✅ Soft delete (activo = false)
  * ✅ Desactiva roles asociados
  * ✅ Preserva histórico de solicitudes
  * ✅ No se puede desactivar si tiene solicitudes pendientes

- [ ] `cambiarContrasena()`:
  * ✅ Valida password actual con bcrypt.compare()
  * ✅ Hashea nueva password con bcrypt
  * ✅ Rechaza si password actual incorrecta (401)
  * ✅ Valida nueva password (mínimo 8 caracteres)

- [ ] `asignarRolConValidacion()`:
  * ✅ Asigna rol sin duplicados
  * ✅ Valida que JEFE requiere departamentoId
  * ✅ Rechaza asignar múltiples roles jerárquicos

**Coverage esperado**: >80%  
**Commit**: `test(integration): Tests de integración usuarios.service`

#### **1.4 Tests de integración - reportes.service** (1.5h)
Crear `tests/integration/reportes.service.integration.test.ts`

**Tests a implementar:**
- [ ] `generarReporteGeneral()`:
  * ✅ Retorna métricas correctas del sistema
  * ✅ Calcula totales (asignados, usados, pendientes)
  * ✅ Top 10 departamentos ordenados
  * ✅ Tendencia de últimos 6 meses

- [ ] `generarReporteDepartamento()`:
  * ✅ Filtra solo colaboradores del departamento
  * ✅ Calcula próximas vacaciones (30 días)
  * ✅ Retorna 404 si departamento no existe

- [ ] `exportarReporteCSV()`:
  * ✅ Genera CSV válido (RFC 4180)
  * ✅ Incluye UTF-8 BOM para Excel
  * ✅ Headers correctos

**Coverage esperado**: >70%  
**Commit**: `test(integration): Tests de integración reportes.service`

#### **1.5 Validación y métricas de coverage** (30min)
- [ ] Ejecutar suite completa: `pnpm test`
- [ ] Generar reporte de coverage: `pnpm test:coverage`
- [ ] Verificar coverage >75% en servicios
- [ ] Documentar resultados en `TESTING_REPORT.md`
- [ ] Commit: `docs(test): Agregar reporte de coverage integración`

---

## 📅 DÍA 2 (Jueves 06/02) - Workflows Completos + Estados

### 🎯 Objetivo
Implementar flujos completos de aprobación multinivel y gestión correcta de estados de solicitudes.

### ✅ Tareas

#### **2.1 Máquina de estados de solicitudes** (1.5h)
Crear `src/core/domain/state-machines/solicitud.state-machine.ts`

- [ ] Definir estados válidos:
  ```typescript
  export enum EstadoSolicitud {
    PENDIENTE = 'pendiente',
    APROBADA_JEFE = 'aprobada_jefe',
    APROBADA = 'aprobada',
    RECHAZADA_JEFE = 'rechazada_jefe',
    RECHAZADA = 'rechazada',
    EN_USO = 'en_uso',
    COMPLETADA = 'completada',
    CANCELADA = 'cancelada',
  }
  ```

- [ ] Definir transiciones permitidas:
  ```typescript
  const TRANSICIONES_VALIDAS = {
    pendiente: ['aprobada_jefe', 'rechazada_jefe', 'cancelada'],
    aprobada_jefe: ['aprobada', 'rechazada', 'cancelada'],
    aprobada: ['en_uso', 'cancelada'],
    en_uso: ['completada'],
    // Estados finales: rechazada_jefe, rechazada, completada, cancelada
  };
  ```

- [ ] Crear función `puedeTransicionar(estadoActual, nuevoEstado)`:
  * Valida transición en TRANSICIONES_VALIDAS
  * Lanza error descriptivo si transición inválida

- [ ] Commit: `feat(domain): Máquina de estados de solicitudes`

#### **2.2 Implementar cancelación de solicitudes** (2h)
Agregar función en `solicitudes.service.ts`

- [ ] `cancelarSolicitud(solicitudId, usuarioId, motivo)`:
  * Validar que usuario es el creador O tiene permiso admin
  * Validar que estado permite cancelación (pendiente, aprobada_jefe, aprobada)
  * Si estado era 'pendiente' o 'aprobada_jefe':
    - Devolver días a balance.cantidadDisponible
  * Si estado era 'aprobada':
    - Devolver días de balance.cantidadUtilizada
  * Cambiar estado a 'cancelada'
  * Registrar auditoría

- [ ] Actualizar API: `DELETE /api/solicitudes/[id]`
  * Llamar a `cancelarSolicitud()`
  * Retornar 200 con mensaje de confirmación

- [ ] Test de integración para cancelación
- [ ] Commit: `feat(services): Implementar cancelación de solicitudes`

#### **2.3 Workflow automático de estados en_uso → completada** (2h)
Crear `src/core/application/jobs/procesar-estados-solicitudes.job.ts`

- [ ] Implementar función `procesarEstadosSolicitudes()`:
  * Buscar solicitudes con estado = 'aprobada' y fecha_inicio <= HOY
    - Cambiar estado a 'en_uso'
  * Buscar solicitudes con estado = 'en_uso' y fecha_fin < HOY
    - Cambiar estado a 'completada'
  * Ejecutar en transacción
  * Logging de cambios

- [ ] Crear API route: `GET /api/cron/procesar-estados`
  * Validar token de seguridad (headers)
  * Ejecutar `procesarEstadosSolicitudes()`
  * Retornar número de solicitudes procesadas

- [ ] Configurar Vercel Cron Job (opcional):
  ```json
  // vercel.json
  {
    "crons": [{
      "path": "/api/cron/procesar-estados",
      "schedule": "0 0 * * *" // Diario a medianoche
    }]
  }
  ```

- [ ] Test de integración para job
- [ ] Commit: `feat(jobs): Workflow automático de estados de solicitudes`

#### **2.4 Notificaciones en pantalla (UI básico)** (2h)
Crear `src/components/ui/NotificationCenter.tsx`

- [ ] Implementar componente de notificaciones:
  * Context API para estado global
  * Stack de notificaciones (top-right)
  * Tipos: success, error, warning, info
  * Auto-dismiss después de 5 segundos
  * Animaciones con Tailwind

- [ ] Crear hook `useNotification()`:
  ```typescript
  const { showSuccess, showError, showWarning } = useNotification();
  showSuccess('Solicitud creada exitosamente');
  ```

- [ ] Integrar en layouts principales
- [ ] Actualizar componentes de formularios para usar notificaciones
- [ ] Commit: `feat(ui): Sistema de notificaciones en pantalla`

#### **2.5 Badges y estados visuales mejorados** (1.5h)
Crear `src/components/solicitudes/EstadoBadge.tsx`

- [ ] Componente `EstadoBadge`:
  ```typescript
  interface Props {
    estado: EstadoSolicitud;
    size?: 'sm' | 'md' | 'lg';
  }
  ```
  * Colores consistentes por estado:
    - pendiente: badge-warning
    - aprobada_jefe: badge-info
    - aprobada: badge-success
    - rechazada*: badge-error
    - en_uso: badge-primary
    - completada: badge-ghost
    - cancelada: badge-secondary

- [ ] Textos descriptivos (español friendly):
  * pendiente → "Pendiente Jefe"
  * aprobada_jefe → "Pendiente RRHH"
  * aprobada → "Aprobada"

- [ ] Actualizar componentes que muestran estados:
  * `TablaSolicitudes.tsx`
  * `DetallesSolicitud.tsx`
  * Dashboard cards

- [ ] Commit: `feat(ui): Badges de estados con colores consistentes`

---

## 📅 DÍA 3 (Viernes 07/02) - Frontend Refactor (Componentes Compartidos)

### 🎯 Objetivo
Extraer componentes UI reutilizables, crear librería interna de componentes y reducir duplicación en frontend.

### ✅ Tareas

#### **3.1 Auditoría y planificación de componentes** (1h)
- [ ] Identificar componentes duplicados en codebase:
  * Botones con variantes
  * Cards de información
  * Tablas con paginación
  * Modales de confirmación
  * Forms con validación

- [ ] Crear documento `COMPONENT_LIBRARY.md`:
  * Lista de componentes a crear
  * Props interface de cada uno
  * Ejemplos de uso

- [ ] Commit: `docs(frontend): Planificación de librería de componentes`

#### **3.2 Crear componentes UI base** (3h)
Crear en `src/components/ui/`

**Button variants**:
- [ ] `Button.tsx`:
  ```typescript
  interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
    onClick?: () => void;
    children: React.ReactNode;
  }
  ```
  * Implementar variantes con Tailwind
  * Estado loading con spinner
  * Disabled state
  * Accesibilidad (aria-*)

**Card component**:
- [ ] `Card.tsx`:
  ```typescript
  interface CardProps {
    title?: string;
    subtitle?: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
  }
  ```
  * Header opcional con título y acciones
  * Body con padding consistente
  * Footer opcional

**Input components**:
- [ ] `Input.tsx`: Input con label, error, helper text
- [ ] `Select.tsx`: Select mejorado con validación
- [ ] `DatePicker.tsx`: Input tipo date con formato

**Modal/Dialog**:
- [ ] `Modal.tsx`:
  ```typescript
  interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }
  ```
  * Backdrop con click para cerrar
  * Animaciones suaves
  * Accesibilidad (ESC para cerrar, focus trap)

- [ ] Commit: `feat(ui): Crear componentes UI base reutilizables`

#### **3.3 Crear Table component con paginación** (2.5h)
Crear `src/components/ui/Table.tsx`

- [ ] Implementar tabla genérica:
  ```typescript
  interface TableProps<T> {
    columns: Column<T>[];
    data: T[];
    pagination?: {
      currentPage: number;
      totalPages: number;
      onPageChange: (page: number) => void;
    };
    loading?: boolean;
    emptyMessage?: string;
  }
  
  interface Column<T> {
    key: keyof T;
    header: string;
    render?: (value: any, row: T) => React.ReactNode;
    sortable?: boolean;
  }
  ```

- [ ] Features:
  * Headers con sorting opcional
  * Paginación en footer
  * Loading skeleton mientras carga datos
  * Empty state customizable
  * Responsive (cards en mobile)

- [ ] Crear hook `useTable()`:
  * Manejo de estado de paginación
  * Sorting client-side
  * Filtrado básico

- [ ] Commit: `feat(ui): Componente Table genérico con paginación`

#### **3.4 Crear custom hooks compartidos** (2h)
Crear en `src/hooks/`

- [ ] `useAuth.ts`:
  ```typescript
  export function useAuth() {
    const session = useSession();
    const user = session?.user;
    const hasRole = (rol: string) => user?.roles?.includes(rol);
    const hasPermission = (permiso: string) => {
      // Lógica RBAC client-side
    };
    return { user, hasRole, hasPermission, isAuthenticated: !!user };
  }
  ```

- [ ] `useAsync.ts`:
  ```typescript
  export function useAsync<T>(asyncFn: () => Promise<T>) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    
    const execute = async () => {
      setLoading(true);
      try {
        const result = await asyncFn();
        setData(result);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    
    return { data, loading, error, execute };
  }
  ```

- [ ] `useDebounce.ts`: Debounce para inputs de búsqueda
- [ ] `useLocalStorage.ts`: Persistencia local (preferencias UI)

- [ ] Commit: `feat(hooks): Crear custom hooks compartidos`

#### **3.5 Refactorizar componentes existentes** (1.5h)
- [ ] Actualizar `TablaSolicitudes.tsx` para usar `<Table />`
- [ ] Actualizar botones en formularios para usar `<Button />`
- [ ] Actualizar modales para usar `<Modal />`
- [ ] Eliminar código duplicado

**Métricas esperadas**:
- Reducción de ~300 líneas de código duplicado
- Consistencia visual en toda la app

- [ ] Commit: `refactor(ui): Migrar componentes existentes a librería UI`

---

## 📅 DÍA 4 (Sábado 08/02) - Reportes + Exportación

### 🎯 Objetivo
Completar funcionalidades de reportes con exportación Excel y crear calendario básico de ausencias.

### ✅ Tareas

#### **4.1 Instalar y configurar ExcelJS** (30min)
- [ ] Instalar dependencia:
  ```bash
  pnpm add exceljs
  pnpm add -D @types/exceljs
  ```

- [ ] Crear utility `src/lib/excel-exporter.ts`:
  * Funciones helper para estilos
  * Headers con formato
  * Auto-width de columnas

- [ ] Commit: `chore(deps): Instalar ExcelJS para exportación`

#### **4.2 Implementar exportación Excel en reportes.service** (2.5h)
Completar función `exportarReporteExcel()` en `reportes.service.ts`

- [ ] Implementar generación de Excel:
  ```typescript
  export async function exportarReporteExcel(
    departamentoId?: number
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte Vacaciones');
    
    // Headers con estilo
    worksheet.columns = [
      { header: 'Colaborador', key: 'nombre', width: 25 },
      { header: 'Departamento', key: 'departamento', width: 20 },
      { header: 'Días Asignados', key: 'asignados', width: 15 },
      { header: 'Días Usados', key: 'usados', width: 15 },
      { header: 'Días Disponibles', key: 'disponibles', width: 15 },
    ];
    
    // Aplicar estilos a headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    
    // Agregar datos...
    
    // Totales al final
    // Retornar buffer
    return await workbook.xlsx.writeBuffer();
  }
  ```

- [ ] Crear API route: `GET /api/reportes/exportar/excel?departamentoId=X`
  * Generar Excel con `exportarReporteExcel()`
  * Headers correctos:
    ```typescript
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reporte-vacaciones-${new Date().toISOString().split('T')[0]}.xlsx"`,
    }
    ```

- [ ] Test de integración para exportación
- [ ] Commit: `feat(reportes): Exportación Excel con ExcelJS`

#### **4.3 UI de reportes con botón exportar** (1.5h)
Actualizar `src/app/(dashboard)/reportes/departamento/page.tsx`

- [ ] Agregar botón "Exportar Excel":
  ```typescript
  async function handleExportExcel() {
    const response = await fetch(`/api/reportes/exportar/excel?departamentoId=${deptoId}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${fecha}.xlsx`;
    a.click();
  }
  ```

- [ ] Loading state durante descarga
- [ ] Notificación de éxito/error
- [ ] Commit: `feat(ui): Botón exportar Excel en reportes`

#### **4.4 Implementar calendario básico de ausencias** (3h)
Crear `src/components/calendario/CalendarioAusencias.tsx`

- [ ] Implementar vista de calendario mensual:
  * Grid 7x5 (días de la semana)
  * Navegación mes anterior/siguiente
  * Días con vacaciones marcados con badge
  * Click en día → modal con lista de usuarios ausentes

- [ ] Crear API: `GET /api/calendario/ausencias?mes=2&anio=2026`
  * Retornar solicitudes aprobadas/en_uso del mes
  * Agrupar por fecha
  * Incluir nombre usuario y tipo ausencia

- [ ] Integrar en dashboard de Admin/RRHH
- [ ] Responsive (lista en mobile)
- [ ] Commit: `feat(calendario): Calendario básico de ausencias`

#### **4.5 Mejorar dashboard de RRHH** (1.5h)
Actualizar `src/app/(dashboard)/dashboard/rrhh/page.tsx`

- [ ] Agregar card de "Calendario de Ausencias"
- [ ] Agregar acceso rápido a reportes
- [ ] Métricas destacadas:
  * Solicitudes pendientes RRHH
  * Colaboradores de vacaciones HOY
  * Próximas ausencias (7 días)

- [ ] Commit: `feat(ui): Mejorar dashboard RRHH con calendario`

---

## 📅 DÍA 5 (Domingo 09/02) - QA, Optimización y Cierre

### 🎯 Objetivo
Testing integral del sistema, corrección de bugs, optimización de performance y preparación para deployment.

### ✅ Tareas

#### **5.1 Testing E2E manual de flujos críticos** (2h)
Seguir `TESTING_MANUAL_CHECKLIST.md` (crear si no existe)

**Flujo 1: Empleado solicita vacaciones**
- [ ] Login como empleado
- [ ] Ver balance disponible en dashboard
- [ ] Crear solicitud de vacaciones (5 días)
- [ ] Verificar estado "Pendiente Jefe"
- [ ] Verificar balance pendiente actualizado

**Flujo 2: Jefe aprueba solicitud**
- [ ] Login como jefe
- [ ] Ver solicitudes pendientes de su departamento
- [ ] Aprobar solicitud
- [ ] Verificar estado "Pendiente RRHH"

**Flujo 3: RRHH aprueba final**
- [ ] Login como RRHH
- [ ] Ver solicitudes pendientes aprobación
- [ ] Aprobar solicitud
- [ ] Verificar estado "Aprobada"
- [ ] Verificar balance utilizada actualizado

**Flujo 4: Cancelación de solicitud**
- [ ] Empleado cancela solicitud aprobada
- [ ] Verificar balance disponible restaurado

**Flujo 5: Reportes y exportación**
- [ ] RRHH genera reporte departamento
- [ ] Exportar Excel
- [ ] Verificar columnas y datos correctos

- [ ] Documentar bugs encontrados
- [ ] Commit: `docs(qa): Checklist de testing manual E2E`

#### **5.2 Corrección de bugs críticos** (2.5h)
- [ ] Revisar issues del testing manual
- [ ] Priorizar bugs bloqueantes
- [ ] Corregir uno por uno con commits descriptivos
- [ ] Re-validar flujos afectados

**Bugs comunes esperados**:
- [ ] Fechas en formato incorrecto
- [ ] Permisos RBAC no validando correctamente
- [ ] Balance no sincronizando en edge cases
- [ ] UI responsive con problemas en mobile

- [ ] Commits: `fix(module): Descripción del bug corregido`

#### **5.3 Optimización de performance backend** (2h)
- [ ] **Índices de base de datos**:
  * Verificar índices en:
    - solicitudes(usuarioId, estado, fecha_inicio)
    - balances(usuarioId, anio)
    - usuarios(email) UNIQUE
  * Agregar índices faltantes

- [ ] **Optimizar queries N+1**:
  * Detectar con logging de queries
  * Usar joins en lugar de queries múltiples
  * Ejemplo: Cargar solicitudes CON usuarios CON departamentos

- [ ] **Caché de queries frecuentes** (opcional):
  * Balance del usuario actual
  * Lista de departamentos
  * Configuraciones globales

- [ ] Medir mejoras con herramientas:
  ```bash
  # Antes y después
  pnpm exec autocannon http://localhost:3000/api/solicitudes
  ```

- [ ] Commit: `perf(backend): Optimizar queries e índices BD`

#### **5.4 Optimización de performance frontend** (1.5h)
- [ ] **Lazy loading de módulos**:
  ```typescript
  const ReportesPage = dynamic(() => import('./reportes/page'), {
    loading: () => <LoadingSkeleton />,
  });
  ```

- [ ] **Memoización de componentes pesados**:
  * Usar `React.memo()` en componentes de tabla
  * Usar `useMemo()` para cálculos pesados

- [ ] **Optimizar imágenes**:
  * Usar Next.js `<Image />` component
  * Lazy loading de imágenes

- [ ] **Reducir bundle size**:
  ```bash
  pnpm exec next build
  # Analizar bundle con @next/bundle-analyzer
  ```

- [ ] Commit: `perf(frontend): Lazy loading y optimización de bundle`

#### **5.5 Seguridad y validaciones finales** (1.5h)
- [ ] **Rate limiting en APIs críticas**:
  * Login: 5 intentos por minuto
  * Creación de solicitudes: 10 por hora

- [ ] **Sanitización de inputs**:
  * Validar todos los strings con Zod
  * Escapar HTML en comentarios/motivos

- [ ] **Headers de seguridad**:
  ```typescript
  // next.config.mjs
  headers: [
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    // ...
  ]
  ```

- [ ] **Audit de dependencias**:
  ```bash
  pnpm audit
  pnpm audit --fix
  ```

- [ ] Commit: `chore(security): Hardening de seguridad y rate limiting`

#### **5.6 Documentación final y preparación deployment** (1.5h)
- [ ] Actualizar `README.md`:
  * Instrucciones setup completas
  * Variables de entorno necesarias
  * Comandos de build/test/deploy

- [ ] Crear `DEPLOYMENT.md`:
  * Checklist pre-deployment
  * Configuración Vercel/AWS
  * Migraciones de BD en producción
  * Rollback plan

- [ ] Actualizar `CHANGELOG.md` con Semana 3
- [ ] Actualizar `ARQUITECTURA.md` si hay cambios

- [ ] Crear Pull Request de Semana 3:
  * Título descriptivo
  * Resumen de cambios
  * Métricas alcanzadas
  * Screenshots de nuevas features

- [ ] Commit: `docs: Documentación final Semana 3 + preparación deployment`

---

## ✅ Checklist Final de Domingo 09/02

### **Código**
- [ ] Tests de integración >20 tests implementados
- [ ] Coverage total >80%
- [ ] 0 errores en build
- [ ] 0 warnings críticos en lint
- [ ] Componentes UI reutilizables creados (10+)

### **Funcionalidades**
- [ ] Workflow completo de aprobaciones funcionando
- [ ] Cancelación de solicitudes implementada
- [ ] Job automático de estados (en_uso → completada)
- [ ] Exportación Excel funcionando
- [ ] Calendario básico de ausencias

### **Frontend**
- [ ] Librería de componentes UI (Button, Card, Table, Modal, Input)
- [ ] Custom hooks (useAuth, useAsync, useDebounce)
- [ ] Sistema de notificaciones
- [ ] Badges de estados consistentes
- [ ] Responsive verificado (mobile + desktop)

### **Testing**
- [ ] Suite completa de tests passing (80+ tests)
- [ ] Testing E2E manual completado
- [ ] Bugs críticos corregidos (0 bloqueantes)
- [ ] Performance validada (<2s APIs)

### **Documentación**
- [ ] README.md actualizado
- [ ] DEPLOYMENT.md creado
- [ ] CHANGELOG.md con Semana 3
- [ ] COMPONENT_LIBRARY.md
- [ ] Pull Request creado con descripción completa

### **Deployment Ready**
- [ ] Variables de entorno documentadas
- [ ] Migraciones SQL listas
- [ ] Seed data preparado
- [ ] Configuración Vercel/AWS lista
- [ ] Rollback plan definido

---

## 🎯 Objetivo de Cierre de Semana 3

**Al finalizar el domingo 09/02, el sistema CNI Honduras debe tener**:
- ✅ Coverage de tests >80% (backend + integración)
- ✅ Workflow completo de aprobaciones multinivel
- ✅ Componentes frontend reutilizables (librería interna)
- ✅ Exportación Excel funcionando
- ✅ Calendario básico de ausencias
- ✅ Sistema optimizado (performance + seguridad)
- ✅ Listo para deployment a producción

**Progreso del proyecto**: 45% → **75%** (objetivo)

---

## 🔜 Vista Previa Semana 4

**Semana 4: Deployment + Auditoría + Features Avanzadas**
- [ ] Deployment a producción (Vercel + PostgreSQL AWS RDS)
- [ ] Sistema de auditoría completo con filtros avanzados
- [ ] Notificaciones por email (opcional)
- [ ] Dashboard analytics mejorado con gráficas
- [ ] Gestión de tipos de ausencias customizables
- [ ] Configuración avanzada del sistema
- [ ] Training de usuarios finales

---

**Documento creado**: 5 de febrero de 2026  
**Inicio planeado**: Miércoles 5 de febrero de 2026  
**Fin planeado**: Domingo 9 de febrero de 2026  
**Responsable**: Equipo de desarrollo CNI  
**Próximo milestone**: Semana 4 - Production Deployment

---

**🇭🇳 Consejo Nacional de Inversiones - Honduras**  
**Sistema de Gestión de Vacaciones y Permisos**  
**Integration Testing | Frontend Refactor | Workflows | Excel Export | Calendar**
