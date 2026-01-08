# INSTRUCCIONES DE PRUEBA - ACTIVIDAD 2.2
# POST /api/solicitudes - Crear Solicitud con RBAC

## 📋 Objetivo
Verificar que el endpoint POST /api/solicitudes implementa correctamente:
1. Autenticación (getSession)
2. Autorización (permiso: vacaciones.solicitudes.crear)
3. Validación de propiedad (solo ADMIN/RRHH pueden crear para otros)

## 🔐 Matriz de Permisos

| Rol      | Crear propia | Crear para otros | Permiso                          |
|----------|--------------|------------------|----------------------------------|
| EMPLEADO | ✅ Sí        | ❌ No            | vacaciones.solicitudes.crear     |
| JEFE     | ✅ Sí        | ❌ No            | vacaciones.solicitudes.crear     |
| RRHH     | ✅ Sí        | ✅ Sí            | vacaciones.solicitudes.crear     |
| ADMIN    | ✅ Sí        | ✅ Sí            | vacaciones.solicitudes.crear     |

## 🧪 Casos de Prueba

### ✅ CASO 1: EMPLEADO crea su propia solicitud
**Credenciales:** empleado@cni.hn / Admin123!
**Endpoint:** POST /api/solicitudes
**Body:**
```json
{
  "usuarioId": 4,
  "tipoAusenciaId": 1,
  "fechaInicio": "2026-02-10",
  "fechaFin": "2026-02-14",
  "cantidad": "5",
  "unidad": "dias",
  "motivo": "Vacaciones familiares"
}
```
**Resultado Esperado:** 200/201 con solicitud creada
**Logs Esperados:**
```
📝 POST /api/solicitudes - Usuario: empleado@cni.hn
✅ Permiso: Crear solicitudes
✅ Creando solicitud para usuario: 4
✅ Validación exitosa...
```

### ❌ CASO 2: EMPLEADO intenta crear para otro usuario
**Credenciales:** empleado@cni.hn / Admin123!
**Body:** Cambiar `usuarioId: 1` (intentar crear para admin)
**Resultado Esperado:** 403 Forbidden
**Mensaje:** "Solo puedes crear solicitudes para ti mismo"
**Logs Esperados:**
```
❌ Usuario 4 intentó crear solicitud para usuario 1
```

### ✅ CASO 3: JEFE crea su propia solicitud
**Credenciales:** jefe.tecnologia@cni.hn / Admin123!
**Body:**
```json
{
  "usuarioId": 3,
  "tipoAusenciaId": 1,
  "fechaInicio": "2026-03-01",
  "fechaFin": "2026-03-05",
  "cantidad": "5",
  "unidad": "dias",
  "motivo": "Vacaciones personales"
}
```
**Resultado Esperado:** 200/201 con solicitud creada

### ❌ CASO 4: JEFE intenta crear para su equipo
**Credenciales:** jefe.tecnologia@cni.hn / Admin123!
**Body:** `usuarioId: 4` (empleado de su departamento)
**Resultado Esperado:** 403 Forbidden
**Nota:** Aunque sea su jefe, no puede crear solicitudes por otros

### ✅ CASO 5: RRHH crea su propia solicitud
**Credenciales:** rrhh@cni.hn / Admin123!
**Body:**
```json
{
  "usuarioId": 2,
  "tipoAusenciaId": 1,
  "fechaInicio": "2026-04-01",
  "fechaFin": "2026-04-10",
  "cantidad": "10",
  "unidad": "dias",
  "motivo": "Vacaciones anuales"
}
```
**Resultado Esperado:** 200/201 con solicitud creada

### ✅ CASO 6: RRHH crea solicitud para otro usuario
**Credenciales:** rrhh@cni.hn / Admin123!
**Body:** `usuarioId: 4` (cualquier empleado)
**Resultado Esperado:** 200/201 con solicitud creada
**Nota:** RRHH tiene privilegios para crear solicitudes a nombre de otros

### ✅ CASO 7: ADMIN crea para cualquier usuario
**Credenciales:** admin@cni.hn / Admin123!
**Body:** `usuarioId: 3` o cualquier otro
**Resultado Esperado:** 200/201 con solicitud creada

### ❌ CASO 8: Sin autenticación
**Sin login**
**Resultado Esperado:** 401 Unauthorized
**Mensaje:** "No autenticado"

## 📊 Verificación Manual

### Opción 1: REST Client (VSCode)
1. Instalar extensión "REST Client"
2. Abrir `tests/test-crear-solicitud-rbac.http`
3. Ejecutar cada request con "Send Request"

### Opción 2: PowerShell Script
```powershell
.\tests\test-crear-solicitud-rbac.ps1
```

### Opción 3: Interfaz Web
1. Login con cada rol
2. Ir a "Nueva Solicitud"
3. Llenar formulario y enviar
4. Verificar logs del servidor

## 🔍 Qué Verificar

### En el servidor (terminal):
- ✅ Logs de autenticación: `📝 POST /api/solicitudes - Usuario: xxx`
- ✅ Logs de autorización: `✅ Permiso: Crear solicitudes`
- ✅ Logs de validación: `✅ Creando solicitud para usuario: X`
- ❌ Errores de permisos: `❌ Sin permiso para crear solicitudes`
- ❌ Errores de propiedad: `❌ Usuario X intentó crear solicitud para usuario Y`

### En la respuesta HTTP:
- Status codes correctos (200/201, 401, 403)
- Mensajes de error descriptivos
- Datos de solicitud completos cuando se crea exitosamente

### En la base de datos:
```sql
-- Ver solicitudes creadas
SELECT 
  s.id,
  s.codigo,
  u.email as solicitante,
  s.fecha_inicio,
  s.fecha_fin,
  s.estado,
  s.created_at
FROM solicitudes s
JOIN usuarios u ON s.usuario_id = u.id
ORDER BY s.created_at DESC
LIMIT 10;
```

## ✅ Criterios de Éxito

- [ ] EMPLEADO puede crear para sí mismo
- [ ] EMPLEADO NO puede crear para otros (403)
- [ ] JEFE puede crear para sí mismo
- [ ] JEFE NO puede crear para otros (403)
- [ ] RRHH puede crear para sí mismo
- [ ] RRHH puede crear para otros
- [ ] ADMIN puede crear para cualquiera
- [ ] Sin sesión retorna 401
- [ ] Logs muestran usuario y permisos correctamente
- [ ] Solicitudes se crean en BD con estado "pendiente"

## 🐛 Troubleshooting

### Error: "No tienes permiso para crear solicitudes"
- Verificar que el usuario tiene `vacaciones.solicitudes.crear` en BD
- Verificar que getSession() retorna permisos correctamente

### Error: "Solo puedes crear solicitudes para ti mismo"
- Verificar que `usuarioId` en body coincide con `sessionUser.id`
- Para ADMIN/RRHH, verificar flags `esAdmin` o `esRrhh`

### Error 401: "No autenticado"
- Verificar que la sesión existe (cookie NextAuth)
- Verificar que getSession() funciona correctamente

## 📝 Notas Importantes

1. **Tipos de ausencia:** ID 1 suele ser "Vacaciones", ajustar según BD
2. **Fechas:** Usar fechas futuras para evitar conflictos
3. **Días disponibles:** Verificar que usuarios tienen balance suficiente
4. **Estado inicial:** Todas las solicitudes se crean con estado "pendiente"
5. **Código auto-generado:** El sistema genera automáticamente el código SOL-YYYY-XXXXX
