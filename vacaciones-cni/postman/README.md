# 📮 Postman Collection - CNI Vacaciones RBAC

Colección completa para testing de todos los endpoints del sistema con diferentes roles de usuario.

---

## 📦 Archivos Incluidos

- **`CNI-Vacaciones-RBAC.postman_collection.json`**: Colección con 25 endpoints organizados
- **`CNI-Vacaciones-RBAC.postman_environment.json`**: Environment "CNI - Local Admin" pre-configurado

---

## 🚀 Instalación

### 1. Importar en Postman

1. Abre **Postman**
2. Clic en **Import** (botón arriba a la izquierda)
3. Arrastra los 2 archivos JSON de esta carpeta:
   - `CNI-Vacaciones-RBAC.postman_collection.json`
   - `CNI-Vacaciones-RBAC.postman_environment.json`
4. Confirma la importación

### 2. Seleccionar Environment

1. En la esquina superior derecha, selecciona el dropdown de environments
2. Elige: **"CNI - Local Admin"**

---

## 📋 Estructura de la Colección

### 01. Autenticación (1)
- **Login** - Autenticación con email/password (guarda token automáticamente)

### 02. Solicitudes (5)
- GET Solicitudes - Ver todas/propias según rol
- POST Solicitud - Crear nueva solicitud
- PATCH Aprobar - Jefe (solo su departamento)
- PATCH Aprobar - RRHH (todas)
- PATCH Rechazar

### 03. Usuarios (4)
- GET Usuarios - Admin/RRHH ver todos
- POST Usuario - Admin/RRHH crear
- PATCH Usuario - Admin/RRHH editar
- DELETE Usuario - Admin/RRHH desactivar

### 04. Balances (3)
- GET Balance - Propio (todos pueden ver)
- GET Balance - Otros (solo Admin/RRHH)
- PATCH Balance - Ajuste manual (Admin/RRHH)

### 05. Reportes (3)
- GET Reportes General (Admin/RRHH)
- GET Reportes Departamento (Admin/RRHH/Jefe su depto)
- GET Exportar Reporte (Admin/RRHH)

### 06. Dashboard (4)
- GET Dashboard Métricas
- GET Dashboard Calendario
- GET Dashboard Mi Balance
- GET Dashboard Actividad

### 07. Mi Perfil (3)
- GET Mi Perfil
- PATCH Mi Perfil - Actualizar contacto
- PATCH Cambiar Contraseña

### 08. Gestión de Roles (2)
- POST Asignar Rol (Admin/RRHH)
- DELETE Remover Rol (Admin/RRHH)

---

## 🔑 Flujo de Uso

### Paso 1: Login

1. Abre la carpeta **"01. Autenticación"**
2. Ejecuta el request **"Login"**
3. El script automático guardará el token en `{{authToken}}`
4. Verifica en el tab "Tests" que se guardó correctamente

```javascript
// Script automático incluido en Login:
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    pm.environment.set('authToken', jsonData.authToken);
    console.log('Token guardado:', jsonData.authToken);
}
```

### Paso 2: Probar Endpoints

Ahora puedes ejecutar cualquier endpoint de las demás carpetas.

**Ejemplo - Obtener solicitudes:**
1. Abre **"02. Solicitudes"** → **"GET Solicitudes"**
2. Clic en **Send**
3. Verás las solicitudes según el rol del usuario logueado

### Paso 3: Probar con Diferentes Roles

Para probar con otros roles, tienes 2 opciones:

#### Opción A: Crear más environments (Recomendado)

1. Duplica el environment "CNI - Local Admin"
2. Renómbralo a "CNI - Local RRHH"
3. Modifica las variables:
   ```
   email: rrhh@cni.hn
   password: RRHH123!
   authToken: (dejar vacío)
   ```
4. Repite para Jefe y Empleado
5. Cambia de environment y ejecuta Login nuevamente

#### Opción B: Editar variables del environment actual

1. Clic en el ícono de ojo 👁️ (esquina superior derecha)
2. Edita `email` y `password` con las credenciales del rol deseado:
   - **RRHH**: `rrhh@cni.hn` / `RRHH123!`
   - **Jefe**: `jefe@cni.hn` / `Jefe123!`
   - **Empleado**: `empleado@cni.hn` / `Emp123!`
3. Borra el valor de `authToken`
4. Ejecuta Login nuevamente

---

## 👥 Usuarios de Prueba

| Rol | Email | Password | Permisos |
|-----|-------|----------|----------|
| **Admin** | admin@cni.hn | Admin123! | 21 permisos (todos) |
| **RRHH** | rrhh@cni.hn | RRHH123! | 18 permisos |
| **Jefe** | jefe@cni.hn | Jefe123! | 12 permisos |
| **Empleado** | empleado@cni.hn | Emp123! | 5 permisos |

---

## 🧪 Casos de Prueba Recomendados

### Test 1: Scope Contextual - Jefe

1. Login como **Jefe** (jefe@cni.hn)
2. GET Solicitudes → Debe ver solo solicitudes de su departamento (dept 1)
3. PATCH Aprobar Jefe → Solo puede aprobar solicitudes de su departamento

### Test 2: Permisos Restrictivos - Empleado

1. Login como **Empleado** (empleado@cni.hn)
2. GET Solicitudes → Solo ve sus propias solicitudes
3. GET Usuarios → Debe retornar **403 Forbidden**
4. GET Balance (propio) → ✅ Puede ver su balance
5. GET Balance (otro usuario) → ❌ 403 Forbidden

### Test 3: Permisos Elevados - Admin/RRHH

1. Login como **Admin** (admin@cni.hn)
2. GET Usuarios → Ve todos los usuarios del sistema
3. POST Usuarios → Puede crear usuarios nuevos
4. GET Reportes General → Acceso completo a reportes
5. PATCH Balance → Puede ajustar balances de cualquier usuario

---

## 🔧 Variables de Entorno

El environment incluye estas variables que puedes usar en los requests:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `baseUrl` | `http://localhost:3000` | URL base del servidor |
| `email` | `admin@cni.hn` | Email del usuario (editable) |
| `password` | `Admin123!` | Password del usuario (editable) |
| `authToken` | *(vacío inicialmente)* | Token JWT (se llena automáticamente) |

Para usar en requests: `{{nombreVariable}}`

---

## 📊 Testing Exhaustivo Realizado

Todos los endpoints han sido validados con 4 roles diferentes:

✅ **27/27 endpoints** testeados  
✅ **100% de cobertura** RBAC  
✅ **0 bugs críticos** encontrados  
✅ **Documentación completa** en `TESTING_RBAC.md`

### Resultados por Categoría

| Categoría | Endpoints | Status |
|-----------|-----------|--------|
| Autenticación | 1 | ✅ PASS |
| Solicitudes | 5 | ✅ PASS |
| Usuarios | 6 | ✅ PASS |
| Balances | 2 | ✅ PASS |
| Reportes | 3 | ✅ PASS |
| Dashboard | 5 | ✅ PASS |
| Mi Perfil | 3 | ✅ PASS |
| Gestión Roles | 2 | ✅ PASS |

---

## 🐛 Solución de Problemas

### Error: "authToken is not defined"

**Causa**: No has ejecutado el request "Login" primero.

**Solución**: 
1. Ejecuta **"01. Autenticación" → "Login"**
2. Verifica en Console que el token se guardó
3. Intenta el endpoint nuevamente

### Error: 403 Forbidden

**Causa**: El usuario actual no tiene permisos para ese endpoint.

**Solución**:
- Verifica que el rol del usuario tenga el permiso necesario
- Consulta la matriz de permisos en `TESTING_RBAC.md`
- Si es correcto, puede ser un bug (reportar en Issues)

### Error: 401 Unauthorized

**Causa**: Token expirado o inválido.

**Solución**:
1. Borra el valor de `authToken` en el environment
2. Ejecuta Login nuevamente
3. Reintenta el endpoint

### No aparece la colección después de importar

**Solución**:
1. Verifica que importaste el archivo `.postman_collection.json`
2. Busca "CNI Vacaciones" en el buscador de Postman
3. Revisa la carpeta "Collections" en el panel izquierdo

---

## 📚 Documentación Relacionada

- **Testing completo**: Ver `../TESTING_RBAC.md`
- **Tasklist de implementación**: Ver `../SEMANA_1_TASKLIST.md`
- **Documentación RBAC**: Ver `../INTEGRACION_RBAC_PENDIENTE.md`

---

## 🤝 Contribuir

Si encuentras problemas o quieres agregar más test cases:

1. Modifica los archivos JSON directamente en esta carpeta
2. Re-importa en Postman para verificar cambios
3. Exporta nuevamente desde Postman si haces cambios allí

---

## 📝 Notas

- Los requests usan autenticación **Bearer Token** automáticamente
- El token se pasa en el header: `Authorization: Bearer {{authToken}}`
- La configuración de Auth está a nivel de colección (herencia a todos los requests)
- Algunos endpoints requieren IDs específicos (ajusta según tu BD)

---

**Creado**: 13 de enero de 2026  
**Versión**: 1.0  
**Sistema**: CNI Honduras - Gestión de Vacaciones  
**Endpoints**: 25 requests en 8 categorías
