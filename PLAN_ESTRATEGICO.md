# 📋 PLAN ESTRATÉGICO - SISTEMA GESTIÓN DE VACACIONES
## Análisis y Roadmap de 7 Días

### 🔴 ESTADO ACTUAL DEL PROYECTO

#### ✅ Completado (70% funcional)
- ✓ Autenticación con NextAuth
- ✓ Base de datos PostgreSQL + Drizzle ORM
- ✓ 4 roles diferenciados (Admin, Jefe, RRHH, Empleado)
- ✓ Módulo de Solicitudes (creación, listado, filtros)
- ✓ Dashboard base para cada rol
- ✓ Módulo Aprobar Solicitudes (Jefe)
- ✓ Módulo Mi Equipo (Jefe)
- ✓ Módulo Reportes Departamento (UI)
- ✓ Gestión de Usuarios
- ✓ UI con DaisyUI y Tailwind

#### 🟡 Parcialmente Implementado (necesita corrección)
- ⚠️ Dashboards con datos incorrectos
- ⚠️ API de métricas (recién separada, necesita pruebas)
- ⚠️ Balance de días (cálculos)
- ⚠️ Calendario de vacaciones
- ⚠️ Módulo RRHH (código con errores de dependencias)

#### 🔴 Deuda Técnica Crítica
- ❌ Código duplicado en múltiples archivos
- ❌ Módulo dashboard/rrhh/page.tsx con imports rotos
- ❌ Falta validación de datos en backend
- ❌ Sin manejo robusto de errores
- ❌ Logs de debug en producción
- ❌ Sin tests

#### ⚫ No Implementado
- ❌ Workflows de aprobación completos (Jefe → RRHH → Admin)
- ❌ Notificaciones
- ❌ Auditoría funcional
- ❌ Export de reportes (Excel/PDF)
- ❌ Calendario interactivo
- ❌ Gestión de tipos de ausencias
- ❌ Configuración avanzada

---

## 🎯 ESTRATEGIA: PRIORIZACIÓN MoSCoW

### MUST HAVE (Semana 1 - Días 1-4) 🔥
**Sin esto, el sistema NO es usable**

1. **Flujo completo de solicitud de vacaciones**
   - Empleado → Crear solicitud
   - Jefe → Aprobar/Rechazar
   - RRHH → Aprobación final
   - Sistema → Actualizar balance

2. **Balance de días correcto**
   - Cálculo: Asignados - Usados - Pendientes = Disponibles
   - Sincronización con solicitudes
   - Validación antes de crear solicitud

3. **Dashboards funcionales**
   - Admin: Métricas globales reales
   - Jefe: Solo su departamento
   - RRHH: Métricas globales
   - Empleado: Su balance personal

4. **Datos maestros básicos**
   - Usuarios activos/inactivos
   - Departamentos
   - Asignación de días por año

### SHOULD HAVE (Días 5-6) ⚡
**Importante pero no bloqueante**

1. **Reportes básicos**
   - Departamento: Uso de vacaciones
   - RRHH: Reporte general
   - Export básico a Excel

2. **Calendario simple**
   - Vista mensual con usuarios de vacaciones
   - Solo lectura

3. **Mejoras UX**
   - Notificaciones en pantalla
   - Estados claros de solicitudes
   - Validaciones de formulario

### COULD HAVE (Día 7) ✨
**Si hay tiempo**

1. Auditoría básica (log de acciones)
2. Filtros avanzados
3. Gráficas en reportes

### WON'T HAVE (v2.0) ⏸️
**Para después del lanzamiento**

1. Notificaciones por email
2. App móvil
3. Integración con RRHH externo
4. BI avanzado

---

## 📅 ROADMAP DETALLADO - 7 DÍAS

### 🔵 DÍA 1-2: ESTABILIZACIÓN Y CORE (Fundación)

#### Objetivos
- Eliminar errores críticos
- Establecer arquitectura limpia
- Base de datos estable

#### Tareas Críticas

**Mañana Día 1:**
1. ✅ **Fix DashboardClient** (YA HECHO)
2. 🔧 **Limpiar dashboard/rrhh/page.tsx**
   - Eliminar imports inexistentes
   - Simplificar componente
   - Usar solo APIs propias

3. 🗄️ **Verificar esquema BD**
   ```sql
   -- Verificar constraints
   -- Verificar índices
   -- Seed data de prueba completo
   ```

4. 📊 **Probar APIs de métricas**
   - `/api/dashboard/admin/metricas`
   - `/api/dashboard/jefe/metricas`
   - `/api/dashboard/rrhh/metricas`
   - `/api/dashboard/mi-balance`

**Tarde Día 1:**
5. 🔄 **Workflow de Solicitudes - Backend**
   - POST `/api/solicitudes` → estado: 'pendiente'
   - PATCH `/api/solicitudes/[id]` → aprobar_jefe
   - PATCH `/api/solicitudes/[id]` → aprobar_rrhh
   - Hook: Actualizar balance automáticamente

6. ✅ **Validaciones Backend**
   - No puede solicitar más días de los disponibles
   - No puede tener solicitudes superpuestas
   - Fechas futuras obligatorias

**Mañana Día 2:**
7. 💰 **Sistema de Balance - Fix Completo**
   ```typescript
   // Función centralizada de cálculo
   function calcularBalance(usuarioId, anio) {
     - Asignados (tabla balances_ausencias)
     - Usados (solicitudes estado: en_uso, completada)
     - Pendientes (solicitudes estado: pendiente, aprobada_jefe)
     - Disponibles = Asignados - Usados - Pendientes
   }
   ```

8. 🎯 **Dashboard Admin - Corrección**
   - Usar endpoint `/api/dashboard/admin/metricas`
   - Mostrar datos reales
   - Gráfica simple de uso

**Tarde Día 2:**
9. 👔 **Dashboard Jefe - Corrección**
   - Filtrado correcto por departamento
   - Integración con Mi Equipo
   - Botón directo a aprobar

10. 🧪 **Testing Manual Crítico**
    - Crear usuario → asignar días → crear solicitud
    - Aprobar solicitud → verificar balance
    - Rechazar solicitud → verificar balance

---

### 🟢 DÍA 3-4: WORKFLOWS COMPLETOS (Funcionalidad Core)

**Día 3:**

11. 📝 **Flujo Completo Solicitudes**
    ```
    Empleado → Crear Solicitud
      ↓ (estado: pendiente)
    Jefe → Aprobar/Rechazar
      ↓ (estado: aprobada_jefe / rechazada_jefe)
    RRHH → Aprobar Final/Rechazar
      ↓ (estado: aprobada / rechazada)
    Sistema → Actualizar Balance
      ↓ (cuando llega fecha_inicio)
    Estado: en_uso
      ↓ (cuando llega fecha_fin)
    Estado: completada
    ```

12. 🔔 **Estados de Solicitudes - Claridad**
    - Badges con colores consistentes
    - Descripciones claras
    - Botones de acción según estado

13. 👥 **Módulo RRHH - Simplificado**
    - Vista de todas las solicitudes
    - Filtros: departamento, estado, fechas
    - Aprobar/Rechazar final

**Día 4:**

14. 📊 **Reportes Básicos - Backend**
    - `/api/reportes/departamento` (ya existe, probar)
    - `/api/reportes/general` (nuevo para RRHH/Admin)
    - Datos agregados: uso por mes, por departamento

15. 📈 **Reportes - Frontend Funcional**
    - Conectar UI existente con backend
    - Mostrar datos reales
    - Filtros de fecha funcionales

16. 📅 **Asignación de Días - Simplificado**
    - Asignación masiva por año
    - Asignación individual
    - Validación: no asignar duplicado

---

### 🟡 DÍA 5-6: POLISH Y UX (Experiencia)

**Día 5:**

17. 🎨 **Mejoras UX Críticas**
    - Loading states consistentes
    - Error messages útiles
    - Confirmaciones de acciones
    - Breadcrumbs funcionales

18. 📱 **Responsive - Verificación**
    - Mobile: Menú hamburguesa
    - Tablet: Cards adaptables
    - Desktop: Full layout

19. 🔐 **Seguridad Básica**
    - Validar roles en cada API
    - Sanitizar inputs
    - Rate limiting básico

**Día 6:**

20. 📁 **Export Excel - Básico**
    - Librería: xlsx
    - Reportes descargables
    - Formato simple pero funcional

21. 📖 **Calendario - Vista Simple**
    - Mostrar días con vacaciones
    - Click → ver quién está de vacaciones
    - Sin edición

22. ⚡ **Optimización Performance**
    - Lazy loading de módulos
    - Caché de queries frecuentes
    - Índices en BD

---

### 🔴 DÍA 7: QA Y DEPLOYMENT (Lanzamiento)

**Mañana:**

23. 🧪 **Testing Integral**
    - Flujo de cada rol (4 flujos)
    - Edge cases: fechas, balances
    - Cross-browser básico

24. 🐛 **Bug Fixing**
    - Priorizar bugs críticos
    - Documentar bugs menores para v2

**Tarde:**

25. 📝 **Documentación Básica**
    - README con setup
    - Manual de usuario simple (PDF)
    - Variables de entorno

26. 🚀 **Deployment**
    - Vercel/AWS
    - BD en producción
    - Configurar dominios
    - Seed data inicial

27. ✅ **Handover**
    - Demo al cliente
    - Training básico
    - Soporte post-lanzamiento

---

## 🏗️ ARQUITECTURA RECOMENDADA

### Estructura de Carpetas Limpia
```
src/
├── app/
│   ├── api/
│   │   ├── solicitudes/
│   │   ├── usuarios/
│   │   ├── balance/
│   │   └── dashboard/
│   │       ├── admin/
│   │       ├── jefe/
│   │       ├── rrhh/
│   │       └── empleado/
│   ├── dashboard/
│   ├── solicitudes/
│   └── [otros módulos]/
├── components/
│   ├── ui/           (botones, inputs genéricos)
│   ├── dashboard/    (componentes específicos)
│   └── solicitudes/
├── lib/
│   ├── db/
│   ├── validations/
│   └── utils/
└── services/
    ├── balance.service.ts
    ├── solicitudes.service.ts
    └── usuarios.service.ts
```

### Principios a Seguir

1. **DRY - Don't Repeat Yourself**
   - Crear funciones reutilizables para cálculos
   - Componentes UI genéricos

2. **Single Responsibility**
   - Cada API hace una cosa
   - Cada componente tiene un propósito

3. **Separation of Concerns**
   - Backend: Lógica de negocio
   - Frontend: Presentación
   - Services: Operaciones complejas

---

## ⚠️ RIESGOS Y MITIGACIÓN

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Cálculos de balance incorrectos | Alta | Crítico | Testing exhaustivo, logs detallados |
| Performance con muchos usuarios | Media | Alto | Índices en BD, paginación |
| Bugs en producción | Alta | Medio | Logging, rollback plan |
| Falta de tiempo | Alta | Alto | Priorización estricta, MVP mínimo |
| Datos inconsistentes | Media | Alto | Transacciones DB, validaciones |

---

## 🎯 CRITERIOS DE ÉXITO (Definición de Done)

### MVP Aceptable (Mínimo para lanzar)

✅ **Funcional:**
1. Usuario puede crear solicitud de vacaciones
2. Jefe puede aprobar/rechazar solicitudes de su equipo
3. RRHH puede dar aprobación final
4. Balance se actualiza correctamente
5. Dashboards muestran datos correctos

✅ **Técnico:**
1. Sin errores de TypeScript
2. APIs responden < 2s
3. Mobile responsive
4. Datos persistentes en BD
5. Autenticación segura

✅ **Negocio:**
1. Flujo completo probado con 5 usuarios reales
2. Cliente aprueba demo
3. Manual de usuario entregado

---

## 🛠️ TAREAS INMEDIATAS (AHORA MISMO)

### Próximos 60 minutos:

1. **Fix dashboard/rrhh/page.tsx** (15 min)
2. **Probar todos los endpoints de métricas** (20 min)
3. **Verificar que balance se calcule bien** (15 min)
4. **Testing manual del flujo de solicitud** (10 min)

¿Empezamos por el dashboard de RRHH que tiene imports rotos?
