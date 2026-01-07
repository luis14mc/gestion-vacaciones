# 📋 SEMANA 1 - Integración RBAC en API Routes

**Sistema de Gestión de Vacaciones - CNI Honduras**  
**Fecha**: 7-13 de enero de 2026 (Miércoles-Martes)  
**Prioridad**: 🔴 CRÍTICA  
**Duración estimada**: 40 horas (5 días laborales)

---

## 🎯 Objetivo Principal

Integrar el sistema RBAC completo en todas las rutas API del sistema, eliminando la dependencia de flags booleanos legacy (`es_admin`, `es_rrhh`, `es_jefe`) y estableciendo control de acceso basado en permisos granulares.

**Riesgo actual**: El sistema tiene control de acceso débil que puede ser manipulado modificando la sesión del usuario.

---

## 📅 DÍA 1 (Miércoles 7/01) - Fundamentos de Autenticación RBAC

### ✅ Tareas

- [ ] **1.1 Actualizar tipo SessionUser** (1h)
  - **Fecha**: Miércoles 7 enero 2026
  - Abrir: `src/types/index.ts`
  - Agregar campos RBAC:
    ```typescript
    roles: Array<{ codigo: string; nombre: string; nivel: number }>;
    permisos: string[];
    ```
  - Mantener campos legacy por compatibilidad
  - Commit: `feat: Actualizar SessionUser con campos RBAC`

- [ ] **1.2 Crear helper de sesión** (2h)
  - Crear archivo: `src/lib/auth.ts`
  - Implementar función `getSession()` que:
    * Lee cookie de sesión
    * Consulta roles y permisos con `obtenerRolesYPermisos()`
    * Retorna SessionUser completo con RBAC
  - Implementar helpers:
    * `tienePermiso(user, permiso)` - Verifica permiso específico
    * `tieneNivelMinimo(user, nivel)` - Verifica nivel jerárquico
  - Testing manual con usuario admin y empleado
  - Commit: `feat: Crear helper de sesión con RBAC`

- [ ] **1.3 Actualizar login para incluir RBAC** (1.5h)
  - Abrir: `src/app/api/auth/login/route.ts`
  - Modificar respuesta de login para incluir roles y permisos
  - Usar `obtenerRolesYPermisos()` después de validar credenciales
  - Guardar roles y permisos en cookie de sesión
  - Testing: Login con admin@cni.hn y verificar roles en respuesta
  - Commit: `feat: Incluir roles y permisos en respuesta de login`

- [ ] **1.4 Crear middleware de protección de rutas** (1.5h)
  - Crear archivo: `src/middleware.ts`
  - Implementar middleware que:
    * Permite rutas públicas (`/login`)
    * Redirige a `/login` si no hay sesión
    * Verifica permisos básicos por ruta
  - Configurar matcher para rutas protegidas
  - Testing: Intentar acceder a `/dashboard` sin login
  - Commit: `feat: Agregar middleware de autorización`

**Total Día 1**: 6 horas  
**Entregables**: 4 archivos modificados/creados, sistema de sesión RBAC funcionando

---

## 📅 DÍA 2 (Jueves 8/01) - API de Solicitudes

### ✅ Tareas

- [ ] **2.1 Integrar RBAC en GET /api/solicitudes** (1.5h)
  - Abrir: `src/app/api/solicitudes/route.ts`
  - Importar `getSession` y `tienePermiso`
  - Verificar permiso `vacaciones.solicitudes.ver_todas`
  - Si no tiene permiso, filtrar solo solicitudes propias
  - Testing con 3 usuarios diferentes (admin, jefe, empleado)
  - Commit: `feat(api): RBAC en GET /api/solicitudes`

- [ ] **2.2 Integrar RBAC en POST /api/solicitudes** (1h)
  - Verificar permiso `vacaciones.solicitudes.crear`
  - Retornar 403 si no tiene permiso
  - Testing: Crear solicitud como empleado y como usuario sin permiso
  - Commit: `feat(api): RBAC en POST /api/solicitudes`

- [ ] **2.3 Integrar RBAC en PATCH /api/solicitudes - Aprobar Jefe** (2h)
  - Verificar permiso `vacaciones.solicitudes.aprobar_jefe`
  - Verificar que el jefe pertenece al departamento del solicitante (scope contextual)
  - Obtener solicitud con datos del usuario
  - Comparar `jefe.departamentoId === solicitud.usuario.departamentoId`
  - Testing: Jefe aprobando solicitud de su depto y de otro depto (debe fallar)
  - Commit: `feat(api): RBAC con scope en aprobación de jefe`

- [ ] **2.4 Integrar RBAC en PATCH /api/solicitudes - Aprobar RRHH** (1h)
  - Verificar permiso `vacaciones.solicitudes.aprobar_rrhh`
  - Validar que solicitud esté en estado `aprobada_jefe`
  - Testing: RRHH aprobando solicitud válida
  - Commit: `feat(api): RBAC en aprobación RRHH`

- [ ] **2.5 Integrar RBAC en PATCH /api/solicitudes - Rechazar** (1h)
  - Verificar permiso `vacaciones.solicitudes.rechazar`
  - Permitir rechazo en cualquier estado excepto `aprobada` o `rechazada`
  - Testing: Jefe y RRHH rechazando solicitudes
  - Commit: `feat(api): RBAC en rechazo de solicitudes`

**Total Día 2**: 6.5 horas  
**Entregables**: API de solicitudes 100% con RBAC, 5 commits

---

## 📅 DÍA 3 (Viernes 9/01) - API de Usuarios

### ✅ Tareas

- [ ] **3.1 Integrar RBAC en GET /api/usuarios** (1h)
  - Verificar permiso `usuarios.ver`
  - Retornar 403 si no tiene permiso
  - Opcionalmente filtrar por departamento si es jefe
  - Testing: Admin, RRHH y Jefe consultando usuarios
  - Commit: `feat(api): RBAC en GET /api/usuarios`

- [ ] **3.2 Integrar RBAC en POST /api/usuarios** (1.5h)
  - Verificar permiso `usuarios.crear`
  - Validar que email sea único
  - Crear usuario con rol por defecto EMPLEADO
  - Testing: Admin creando usuario nuevo
  - Commit: `feat(api): RBAC en POST /api/usuarios`

- [ ] **3.3 Integrar RBAC en PATCH /api/usuarios** (1h)
  - Verificar permiso `usuarios.editar`
  - Validar que usuario existe
  - Actualizar datos
  - Testing: RRHH editando datos de empleado
  - Commit: `feat(api): RBAC en PATCH /api/usuarios`

- [ ] **3.4 Integrar RBAC en DELETE /api/usuarios** (1h)
  - Verificar permiso `usuarios.eliminar`
  - Soft delete (marcar como inactivo)
  - Desactivar roles del usuario
  - Testing: Admin desactivando usuario
  - Commit: `feat(api): RBAC en DELETE /api/usuarios`

- [ ] **3.5 Crear endpoint POST /api/usuarios/roles** (2h)
  - Crear archivo: `src/app/api/usuarios/roles/route.ts`
  - Endpoint para asignar rol a usuario
  - Verificar permiso `usuarios.editar`
  - Body: `{ usuarioId, rolCodigo, departamentoId? }`
  - Usar `asignarRolAUsuario()` del servicio RBAC
  - Testing: Admin asignando rol JEFE a usuario
  - Commit: `feat(api): Crear endpoint para asignar roles`

- [ ] **3.6 Crear endpoint DELETE /api/usuarios/roles** (1h)
  - En mismo archivo de 3.5
  - Endpoint para remover rol de usuario
  - Usar `removerRolDeUsuario()` del servicio RBAC
  - Testing: Admin removiendo rol de usuario
  - Commit: `feat(api): Crear endpoint para remover roles`

**Total Día 3**: 7.5 horas  
**Entregables**: API de usuarios completa con RBAC, endpoint de gestión de roles

---

## 📅 DÍA 4 (Lunes 12/01) - APIs de Balances y Reportes

### ✅ Tareas

- [ ] **4.1 Integrar RBAC en GET /api/balances** (2h)
  - Abrir: `src/app/api/balances/route.ts`
  - Si `usuarioId` === usuario actual → verificar `balances.ver_propios`
  - Si `usuarioId` !== usuario actual → verificar `balances.ver_todos`
  - Retornar 403 si no tiene permiso apropiado
  - Testing: 
    * Empleado viendo su balance ✅
    * Empleado viendo balance de otro ❌
    * RRHH viendo balance de cualquiera ✅
  - Commit: `feat(api): RBAC en GET /api/balances`

- [ ] **4.2 Integrar RBAC en PATCH /api/balances** (1.5h)
  - Endpoint para ajustes manuales de balance (solo RRHH)
  - Verificar permiso `balances.editar`
  - Body: `{ balanceId, cantidadAsignada, motivo }`
  - Registrar cambio en auditoría
  - Testing: RRHH ajustando balance de empleado
  - Commit: `feat(api): RBAC en edición manual de balances`

- [ ] **4.3 Integrar RBAC en GET /api/reportes/general** (1h)
  - Abrir: `src/app/api/reportes/general/route.ts`
  - Verificar permiso `reportes.general`
  - Solo ADMIN y RRHH pueden ver
  - Testing: Admin consultando reporte general
  - Commit: `feat(api): RBAC en reportes generales`

- [ ] **4.4 Integrar RBAC en GET /api/reportes/departamento** (1.5h)
  - Abrir: `src/app/api/reportes/departamento/route.ts`
  - Verificar permiso `reportes.departamento`
  - Si es JEFE, filtrar solo su departamento
  - Testing: Jefe viendo reporte de su depto
  - Commit: `feat(api): RBAC en reportes por departamento`

- [ ] **4.5 Integrar RBAC en GET /api/reportes/exportar** (1h)
  - Abrir: `src/app/api/reportes/exportar/route.ts`
  - Verificar permiso `reportes.exportar`
  - Generar Excel/CSV según parámetro
  - Testing: RRHH exportando reporte a Excel
  - Commit: `feat(api): RBAC en exportación de reportes`

**Total Día 4**: 7 horas  
**Entregables**: APIs de balances y reportes con RBAC completo

---

## 📅 DÍA 5 (Martes 13/01) - Dashboard, Testing y Documentación

### ✅ Tareas

- [ ] **5.1 Integrar RBAC en APIs de Dashboard** (2h)
  - `/api/dashboard/stats` - Verificar permisos básicos
  - `/api/dashboard/calendario` - Filtrar por permisos
  - `/api/dashboard/mi-balance` - Solo balance propio
  - `/api/dashboard/actividad` - Según rol mostrar actividad relevante
  - Testing: Verificar cada endpoint con diferentes roles
  - Commit: `feat(api): RBAC en endpoints de dashboard`

- [ ] **5.2 Testing exhaustivo de todos los endpoints** (3h)
  - Crear tabla de testing:
    | Endpoint | Admin | RRHH | Jefe | Empleado |
    |----------|-------|------|------|----------|
    | GET /api/solicitudes | ✅ Todas | ✅ Todas | ✅ Su depto | ✅ Propias |
    | POST /api/solicitudes | ✅ | ✅ | ✅ | ✅ |
    | PATCH aprobar_jefe | ❌ | ❌ | ✅ | ❌ |
    | PATCH aprobar_rrhh | ✅ | ✅ | ❌ | ❌ |
    | GET /api/usuarios | ✅ | ✅ | ✅ | ❌ |
    | POST /api/usuarios | ✅ | ✅ | ❌ | ❌ |
    | POST /api/usuarios/roles | ✅ | ✅ | ❌ | ❌ |
    | GET /api/balances (propios) | ✅ | ✅ | ✅ | ✅ |
    | GET /api/balances (otros) | ✅ | ✅ | ❌ | ❌ |
    | GET /api/reportes/general | ✅ | ✅ | ❌ | ❌ |
  - Documentar resultados en archivo `TESTING_RBAC.md`
  - Reportar bugs encontrados

- [ ] **5.3 Actualizar Postman/Thunder Client Collection** (1h)
  - Crear carpeta "RBAC Tests"
  - Agregar requests para cada endpoint con diferentes roles
  - Configurar variables de entorno:
    * `{{adminToken}}`
    * `{{rrhhToken}}`
    * `{{jefeToken}}`
    * `{{empleadoToken}}`
  - Exportar collection actualizada

- [ ] **5.4 Documentar cambios en CHANGELOG.md** (1h)
  - Crear sección "Semana 1 - Integración RBAC"
  - Listar todos los endpoints modificados
  - Documentar breaking changes (si los hay)
  - Ejemplos de uso de nuevos endpoints

- [ ] **5.5 Code review y limpieza** (1h)
  - Revisar todos los commits de la semana
  - Eliminar console.logs de debug
  - Verificar que todos los mensajes de error sean descriptivos
  - Asegurar que no haya código comentado

- [ ] **5.6 Build final y validación** (0.5h)
  - Ejecutar `pnpm build`
  - Verificar 0 errores de TypeScript
  - Verificar que las 36 rutas se generen correctamente
  - Commit: `test: Validar integración RBAC completa`

**Total Día 5**: 8.5 horas  
**Entregables**: Sistema 100% testeado, documentación actualizada, collection Postman

---

## 📊 Resumen de la Semana

### Estadísticas Esperadas

| Métrica | Valor |
|---------|-------|
| **Horas totales** | 35.5h de 40h estimadas |
| **Archivos modificados** | ~15-20 archivos |
| **Commits** | ~18-20 commits |
| **Endpoints con RBAC** | 21 endpoints |
| **Tests realizados** | 40+ casos de prueba |
| **Documentación** | 2 archivos nuevos |

### Endpoints con RBAC implementado (21)

#### Solicitudes (5)
- ✅ GET /api/solicitudes
- ✅ POST /api/solicitudes
- ✅ PATCH /api/solicitudes (aprobar_jefe)
- ✅ PATCH /api/solicitudes (aprobar_rrhh)
- ✅ PATCH /api/solicitudes (rechazar)

#### Usuarios (6)
- ✅ GET /api/usuarios
- ✅ POST /api/usuarios
- ✅ PATCH /api/usuarios
- ✅ DELETE /api/usuarios
- ✅ POST /api/usuarios/roles
- ✅ DELETE /api/usuarios/roles

#### Balances (2)
- ✅ GET /api/balances
- ✅ PATCH /api/balances

#### Reportes (3)
- ✅ GET /api/reportes/general
- ✅ GET /api/reportes/departamento
- ✅ GET /api/reportes/exportar

#### Dashboard (5)
- ✅ GET /api/dashboard/stats
- ✅ GET /api/dashboard/calendario
- ✅ GET /api/dashboard/mi-balance
- ✅ GET /api/dashboard/actividad
- ✅ GET /api/dashboard/metricas

### Criterios de Éxito ✅

- [ ] 100% de endpoints con verificación RBAC
- [ ] 0 endpoints usando flags booleanos legacy
- [ ] Middleware de autorización funcional
- [ ] Testing completo con 4 roles diferentes
- [ ] Documentación actualizada
- [ ] Build exitoso sin errores
- [ ] Postman collection actualizada

---

## 🚨 Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Breaking changes en producción | Media | Alto | Testing exhaustivo, deploy en staging primero |
| Usuarios sin roles RBAC | Baja | Alto | Script de verificación antes de deploy |
| Performance degradado | Baja | Medio | Consultas RBAC cacheadas en sesión |
| Time overrun | Media | Medio | Buffer de 4.5h incluido en estimación |

---

## 📝 Notas Importantes

### ⚠️ Antes de Empezar

1. **Backup de BD**: Crear backup completo antes de hacer cambios
2. **Rama feature**: Trabajar en `feature/semana-1-rbac-integration`
3. **Testing local**: Asegurar que todo funcione localmente antes de hacer push
4. **Staging**: Deploy en ambiente de staging para validación final

### 🔑 Datos de Testing

```typescript
// Usuarios de prueba con diferentes roles
const testUsers = {
  admin: { email: 'admin@cni.hn', password: 'Admin123!' },
  rrhh: { email: 'rrhh@cni.hn', password: 'RRHH123!' },
  jefe: { email: 'jefe@cni.hn', password: 'Jefe123!' }, // Crear si no existe
  empleado: { email: 'empleado@cni.hn', password: 'Emp123!' } // Crear si no existe
};
```

### 📞 Contacto de Emergencia

Si encuentras bloqueadores técnicos:
1. Documentar el problema en Issues
2. Consultar con arquitecto senior
3. Revisar documentación de RBAC en `INTEGRACION_RBAC_PENDIENTE.md`

---

## ✅ Checklist Final de Martes 13/01

Antes de dar por completada la semana, verificar:

- [ ] Todos los commits pusheados a `feature/semana-1-rbac-integration`
- [ ] Pull Request creado hacia `main` con descripción detallada
- [ ] Testing completo documentado en `TESTING_RBAC.md`
- [ ] Postman collection actualizada y exportada
- [ ] CHANGELOG.md actualizado
- [ ] Build exitoso en ambiente local
- [ ] Code review solicitado al equipo
- [ ] Demo preparada para stakeholders

---

## 🎯 Objetivo de Cierre de Semana

**Al finalizar el viernes, el sistema CNI Honduras debe tener**:
- ✅ Control de acceso real basado en permisos RBAC
- ✅ 0 dependencias de flags booleanos legacy
- ✅ Seguridad robusta imposible de manipular desde el cliente
- ✅ Base sólida para continuar con Semana 2 (Servicios de Negocio)

**Progreso del proyecto**: 15% → 30% (objetivo)

---

**Documento creado**: 7 de enero de 2026  
**Inicio**: Miércoles 7 de enero de 2026  
**Responsable**: Equipo de desarrollo CNI  
**Revisión**: Martes 13 de enero de 2026  
**Próximo milestone**: Semana 2 - Servicios de Negocio

---

**🇭🇳 Consejo Nacional de Inversiones - Honduras**  
**Sistema de Gestión de Vacaciones y Permisos**  
**Clean Architecture | RBAC Completo | PostgreSQL Optimizado**
