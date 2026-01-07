# 🚀 ACCIONES INMEDIATAS - PRÓXIMA HORA

## ✅ COMPLETADO

1. ✓ Fix DashboardClient.tsx (else duplicado eliminado)
2. ✓ Eliminado dashboard/rrhh/page.tsx (conflicto de imports)
3. ✓ Creados endpoints separados:
   - `/api/dashboard/admin/metricas`
   - `/api/dashboard/jefe/metricas`
   - `/api/dashboard/rrhh/metricas`
   - `/api/dashboard/mi-balance`

## 🔧 SIGUIENTE - Testing y Validación (30 min)

### 1. Probar Endpoints de Métricas (10 min)

Ejecutar el servidor y probar manualmente:

```bash
cd vacaciones-cni
pnpm run dev
```

**Tests manuales:**
- [ ] Login como Admin → Dashboard debe mostrar todos los usuarios
- [ ] Login como Jefe (Elsa) → Dashboard debe mostrar solo Dirección
- [ ] Login como Empleado (Andrés) → Dashboard debe mostrar su balance personal
- [ ] Verificar consola del navegador para logs

### 2. Verificar Cálculo de Balance (10 min)

**Para Andrés (empleado):**
```
Abrir: http://localhost:3000/dashboard
Verificar en consola:
- 🔍 Buscando balance para usuario ID: X
- 💰 Balance encontrado: {cantidadAsignada, cantidadUtilizada}
- ✅ Datos mostrados en UI

Si no muestra datos:
1. Verificar que existe registro en tabla balances_ausencias
2. Año debe ser 2026
3. Estado debe ser 'activo'
```

### 3. Probar Flujo de Solicitud (10 min)

**Como Andrés (empleado):**
1. Ir a "Nueva Solicitud"
2. Llenar formulario
3. Enviar
4. Verificar que aparece en "Mis Solicitudes"
5. Verificar que días pendientes se actualizan en dashboard

**Como Elsa (jefe):**
1. Ir a "Aprobar Solicitudes"
2. Ver solicitud de Andrés
3. Aprobar
4. Verificar cambio de estado

## 📝 CHECKLIST DE SALUD DEL SISTEMA

### Base de Datos
- [ ] Tabla `usuarios` tiene registros
- [ ] Tabla `balances_ausencias` tiene registros para año 2026
- [ ] Tabla `solicitudes` funciona
- [ ] Tabla `departamentos` tiene registros

### APIs Funcionando
- [ ] GET `/api/dashboard/admin/metricas` → 200
- [ ] GET `/api/dashboard/jefe/metricas` → 200
- [ ] GET `/api/dashboard/mi-balance` → 200
- [ ] GET `/api/solicitudes` → 200
- [ ] POST `/api/solicitudes` → 201

### UI Sin Errores
- [ ] No hay errores rojos en consola
- [ ] Dashboards cargan sin timeout
- [ ] Navegación entre módulos funciona
- [ ] Forms se pueden enviar

## 🐛 SI HAY ERRORES

### Error: "No se encontró balance"
```sql
-- Verificar en BD
SELECT * FROM balances_ausencias 
WHERE usuario_id = X AND anio = 2026;

-- Si no existe, crear:
INSERT INTO balances_ausencias 
(usuario_id, tipo_ausencia_id, anio, cantidad_asignada, estado)
VALUES (X, 1, 2026, 15, 'activo');
```

### Error: "Métricas en 0"
```typescript
// Verificar endpoint correcto en DashboardClient.tsx
// Debe ser:
// Admin → /api/dashboard/admin/metricas
// Jefe → /api/dashboard/jefe/metricas
// Empleado → /api/dashboard/mi-balance
```

### Error: "Cannot read property..."
```bash
# Limpiar caché y reinstalar
rm -rf .next
pnpm install
pnpm run dev
```

## 📊 MÉTRICAS DE ÉXITO

Al final de esta hora, deberías tener:
1. ✅ Dashboards mostrando datos reales
2. ✅ Sin errores TypeScript críticos
3. ✅ Flujo de solicitud funcional (crear → ver)
4. ✅ Balance calculado correctamente

## 🎯 SIGUIENTE PASO

Una vez funcionando lo anterior:
→ Implementar workflow completo (Jefe aprueba → RRHH aprueba → Balance actualiza)
