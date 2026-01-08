# 📋 INSTRUCCIONES DE PRUEBA - Actividad 2.3
## RBAC en PATCH /api/solicitudes - Aprobar/Rechazar Solicitudes

---

## 🎯 Objetivo
Validar que el endpoint PATCH `/api/solicitudes` implementa correctamente el control de acceso basado en roles (RBAC) para aprobar, rechazar y cancelar solicitudes de vacaciones.

---

## 🔐 Permisos Evaluados

| Acción | Permiso Requerido | Descripción |
|--------|-------------------|-------------|
| `aprobar_jefe` | `vacaciones.solicitudes.aprobar_jefe` | JEFE aprueba solicitudes de su departamento |
| `aprobar_rrhh` | `vacaciones.solicitudes.aprobar_rrhh` | RRHH aprueba solicitudes (después del jefe) |
| `rechazar` | `vacaciones.solicitudes.rechazar` | JEFE/RRHH rechazan solicitudes |
| `cancelar` | Propietario o ADMIN/RRHH | Usuario cancela su propia solicitud |

---

## 📊 Matriz de Casos de Prueba

| # | Rol | Acción | Contexto | Resultado Esperado | Status |
|---|-----|--------|----------|-------------------|---------|
| 1 | JEFE | aprobar_jefe | Solicitud de su departamento | ✅ 200 - Aprobada | |
| 2 | JEFE | aprobar_jefe | Solicitud de otro departamento | ❌ 403 - Sin permiso | |
| 3 | EMPLEADO | aprobar_jefe | Cualquier solicitud | ❌ 403 - Sin permiso | |
| 4 | RRHH | aprobar_rrhh | Solicitud ya aprobada por jefe | ✅ 200 - Aprobada por RRHH | |
| 5 | RRHH | aprobar_rrhh | Solicitud aún pendiente | ❌ 400 - Estado inválido | |
| 6 | EMPLEADO | aprobar_rrhh | Cualquier solicitud | ❌ 403 - Sin permiso | |
| 7 | JEFE | rechazar | Solicitud de su departamento | ✅ 200 - Rechazada | |
| 8 | JEFE | rechazar | Solicitud de otro departamento | ❌ 403 - Sin permiso | |
| 9 | RRHH | rechazar | Solicitud de cualquier departamento | ✅ 200 - Rechazada | |
| 10 | EMPLEADO | rechazar | Cualquier solicitud | ❌ 403 - Sin permiso | |
| 11 | EMPLEADO | cancelar | Su propia solicitud | ✅ 200 - Cancelada | |
| 12 | EMPLEADO | cancelar | Solicitud de otro usuario | ❌ 403 - Sin permiso | |
| 13 | ADMIN | aprobar_jefe | Solicitud de cualquier dept | ✅ 200 - Aprobada (bypass) | |
| 14 | No Auth | cualquier | Cualquier solicitud | ❌ 401 - No autenticado | |

---

## 🔄 Flujo de Estados de Solicitud

```
pendiente → [JEFE aprueba] → aprobada_jefe → [RRHH aprueba] → aprobada
           ↓                                ↓
      [rechazar]                       [rechazar]
           ↓                                ↓
      rechazada                        rechazada
```

**Estados válidos para cada acción:**
- `aprobar_jefe`: Solo desde `pendiente`
- `aprobar_rrhh`: Solo desde `aprobada_jefe`
- `rechazar`: Desde `pendiente` o `aprobada_jefe`
- `cancelar`: Desde `pendiente` o `aprobada_jefe`

---

## 📊 Actualización de Balances

### Cuando se APRUEBA (RRHH):
```sql
cantidad_pendiente -= días_solicitud
cantidad_utilizada += días_solicitud
```

### Cuando se RECHAZA o CANCELA:
```sql
cantidad_pendiente -= días_solicitud
(Los días quedan disponibles nuevamente)
```

---

## 🧪 Preparación del Entorno

### 1. Usuarios de Prueba Requeridos

```
ID | Email              | Rol      | Departamento | Permisos
---|--------------------|---------|--------------|---------
1  | admin@cni.hn       | ADMIN   | N/A          | Todos
2  | rrhh@cni.hn        | RRHH    | RRHH         | aprobar_rrhh, rechazar
3  | jefe@cni.hn        | JEFE    | IT           | aprobar_jefe, rechazar
4  | empleado@cni.hn    | EMPLEADO| IT           | crear, ver_propias
```

### 2. Solicitudes de Prueba Necesarias

Crear al menos 6 solicitudes en diferentes estados:

```sql
-- Solicitud 1: Pendiente, departamento IT
INSERT INTO solicitudes (usuario_id, estado, ...) VALUES (4, 'pendiente', ...);

-- Solicitud 2: Pendiente, departamento ADMIN  
INSERT INTO solicitudes (usuario_id, estado, ...) VALUES (1, 'pendiente', ...);

-- Solicitud 3-6: Más solicitudes para diferentes casos
```

---

## 🚀 Ejecución de Pruebas

### Opción A: Usar REST Client (VS Code)
1. Abrir archivo: `tests/test-aprobar-rechazar-rbac.http`
2. Instalar extensión: "REST Client" en VS Code
3. Obtener tokens de sesión:
   ```bash
   # Login como cada rol y copiar cookie next-auth.session-token
   ```
4. Reemplazar `TOKEN_JEFE`, `TOKEN_RRHH`, etc. en el archivo
5. Ejecutar cada caso con "Send Request"

### Opción B: Usar cURL
```bash
# Ejemplo: JEFE aprueba solicitud
curl -X PATCH http://localhost:3000/api/solicitudes \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=TOKEN_AQUI" \
  -d '{"solicitudId": 1, "accion": "aprobar_jefe"}'
```

### Opción C: Desde el Frontend
1. Login como JEFE en el navegador
2. Ir a "Mis Aprobaciones" o "Gestión de Solicitudes"
3. Aprobar/Rechazar solicitudes desde la interfaz
4. Verificar en DevTools → Network → Response

---

## ✅ Validaciones Esperadas

### Para cada caso exitoso (200):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "estado": "aprobada_jefe",
    "aprobadoPor": 3,
    "fechaAprobacionJefe": "2026-01-08T..."
  },
  "message": "Solicitud aprobada por jefe"
}
```

### Para casos de error (403):
```json
{
  "success": false,
  "error": "No tienes permiso para aprobar solicitudes como jefe"
}
```

### Para validación de estado (400):
```json
{
  "success": false,
  "error": "Solo se pueden aprobar solicitudes previamente aprobadas por el jefe (estado actual: pendiente)"
}
```

---

## 🔍 Verificación de Logs del Servidor

Después de cada request, verificar en terminal:

```
✅ Aprobación exitosa:
🔄 PATCH /api/solicitudes - Usuario: jefe@cni.hn
📋 Solicitud SOL-2026-12345 - Estado actual: pendiente
🎯 Acción solicitada: aprobar_jefe
✅ Aprobación de jefe autorizada
✅ Solicitud aprobada por jefe - Nuevo estado: aprobada_jefe
```

```
❌ Rechazo por falta de permiso:
🔄 PATCH /api/solicitudes - Usuario: empleado@cni.hn
❌ Sin permiso para aprobar como jefe
```

---

## 📝 Registro de Resultados

Completar la matriz de casos de prueba marcando cada resultado:

- ✅ = Comportamiento correcto
- ❌ = Fallo inesperado
- ⚠️ = Requiere revisión

### Notas:
```
Caso 1: ✅ Aprobado correctamente
Caso 2: ✅ Rechazado por departamento diferente
Caso 3: ✅ Rechazado por falta de permiso
...
```

---

## 🐛 Problemas Comunes

### 1. Error "No autenticado" (401)
**Causa:** Token de sesión expirado o inválido
**Solución:** Hacer login nuevamente y obtener nuevo token

### 2. Error "Solicitud no encontrada" (404)
**Causa:** El `solicitudId` no existe en la base de datos
**Solución:** Verificar IDs de solicitudes existentes con:
```sql
SELECT id, codigo, estado FROM solicitudes;
```

### 3. Error "Estado inválido" (400)
**Causa:** La solicitud no está en el estado correcto para la acción
**Solución:** Verificar flujo de estados y ejecutar acciones en orden

### 4. Balance no se actualiza
**Causa:** Campos calculados mal o SQL fallido
**Solución:** Verificar logs del servidor y ejecutar:
```sql
SELECT * FROM balances_ausencias WHERE usuario_id = X;
```

---

## 🎓 Criterios de Aceptación

Para considerar la actividad como **COMPLETA**, deben cumplirse:

- ✅ Todos los casos de la matriz ejecutan correctamente
- ✅ JEFE solo puede aprobar/rechazar de su departamento
- ✅ RRHH puede aprobar/rechazar de cualquier departamento
- ✅ EMPLEADO solo puede cancelar sus propias solicitudes
- ✅ Validación de flujo de estados funciona
- ✅ Balances se actualizan correctamente en cada acción
- ✅ Logs del servidor son claros y descriptivos
- ✅ Sin autenticación devuelve 401
- ✅ Sin permisos devuelve 403

---

## 📅 Tiempo Estimado
- Preparación: 15 min
- Ejecución: 30 min  
- Verificación: 15 min
- **Total:** 1 hora

---

## 📌 Siguiente Paso
Una vez completada esta actividad, continuar con:
- **Actividad 2.4:** Notificaciones y auditoría de cambios de estado
