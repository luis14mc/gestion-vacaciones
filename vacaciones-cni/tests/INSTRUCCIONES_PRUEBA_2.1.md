# 🧪 Instrucciones de Prueba - Actividad 2.1

## GET /api/solicitudes con RBAC

### Objetivo
Verificar que el endpoint GET /api/solicitudes implementa correctamente RBAC:
- ✅ ADMIN y RRHH pueden ver TODAS las solicitudes
- ✅ JEFE y EMPLEADO solo ven SUS propias solicitudes
- ✅ Se valida autenticación (401 si no está logueado)
- ✅ Se valida autorización (403 si no tiene permisos)

---

## 📋 Pasos de Prueba Manual

### 1. Abrir el navegador
Ve a: http://localhost:3000/login

### 2. Probar con ADMIN
1. **Login**: Haz clic en el botón "Admin"
   - Email: `admin@cni.hn`
   - Password: `Admin123!`
2. **Navegar a Solicitudes**: http://localhost:3000/solicitudes
3. **Verificar**: Deberías ver TODAS las solicitudes (si hay alguna)
4. **Abrir consola del navegador (F12)**
5. **Verificar en Network**: 
   - Request a `/api/solicitudes?pagina=1&limite=20`
   - Status: `200 OK`
   - Response debe tener `data` con array de solicitudes

### 3. Probar con RRHH
1. **Logout**: Cierra sesión
2. **Login**: Haz clic en el botón "RRHH"
   - Email: `rrhh@cni.hn`
   - Password: `Admin123!`
3. **Navegar a Solicitudes**: http://localhost:3000/solicitudes
4. **Verificar**: Deberías ver TODAS las solicitudes (igual que admin)
5. **Consola del navegador**: Verificar status 200

### 4. Probar con JEFE
1. **Logout**: Cierra sesión
2. **Login**: Haz clic en el botón "Jefe"
   - Email: `jefe.tecnologia@cni.hn`
   - Password: `Admin123!`
3. **Navegar a Solicitudes**: http://localhost:3000/solicitudes
4. **Verificar**: Solo deberías ver TUS propias solicitudes (del jefe)
5. **Consola del navegador**: 
   - Status 200
   - Pero `data` solo contiene solicitudes del usuario ID=3

### 5. Probar con EMPLEADO
1. **Logout**: Cierra sesión
2. **Login**: Haz clic en el botón "Empleado"
   - Email: `empleado@cni.hn`
   - Password: `Admin123!`
3. **Navegar a Solicitudes**: http://localhost:3000/solicitudes
4. **Verificar**: Solo deberías ver TUS propias solicitudes (del empleado)
5. **Consola del navegador**: 
   - Status 200
   - Pero `data` solo contiene solicitudes del usuario ID=4

### 6. Probar sin autenticación
1. **Logout**: Cierra sesión completamente
2. **Intentar acceder directamente**: http://localhost:3000/api/solicitudes
3. **Verificar**: Redirección al login o 401 Unauthorized

---

## 🔍 Verificación en Logs del Servidor

En la terminal donde corre `pnpm run dev`, deberías ver:

### Login exitoso (cualquier rol):
```
📋 GET /api/solicitudes - Usuario: admin@cni.hn
✅ Permiso: Ver todas las solicitudes
✅ Retornando X solicitudes (total: X)
```

### JEFE o EMPLEADO:
```
📋 GET /api/solicitudes - Usuario: jefe.tecnologia@cni.hn
✅ Permiso: Ver solo solicitudes propias
✅ Retornando X solicitudes (total: X)
```

### Sin permisos:
```
📋 GET /api/solicitudes - Usuario: X
❌ Sin permisos para ver solicitudes
```

---

## ✅ Criterios de Éxito

- [ ] ADMIN puede ver todas las solicitudes
- [ ] RRHH puede ver todas las solicitudes
- [ ] JEFE solo ve sus propias solicitudes
- [ ] EMPLEADO solo ve sus propias solicitudes
- [ ] Sin login retorna 401
- [ ] Los logs muestran los permisos verificados
- [ ] No hay errores 500 en el servidor
- [ ] La UI de solicitudes se renderiza correctamente

---

## 🐛 Si algo falla

1. **Error 500**: Revisar logs del servidor
2. **Error 401**: Verificar que estás logueado
3. **Error 403**: Verificar que el usuario tiene el permiso correcto
4. **Datos incorrectos**: Verificar que los permisos en BD están correctos

### Verificar permisos en BD:
```sql
-- Ver permisos del usuario
SELECT u.email, r.nombre as rol, p.nombre as permiso
FROM usuarios u
JOIN usuarios_roles ur ON u.id = ur.usuario_id
JOIN roles r ON ur.rol_id = r.id
JOIN roles_permisos rp ON r.id = rp.rol_id
JOIN permisos p ON rp.permiso_id = p.id
WHERE u.email = 'admin@cni.hn';
```

---

## 📝 Notas

- Si no hay solicitudes en la BD, el array `data` estará vacío pero el endpoint debe retornar 200
- Los filtros por `usuarioId` solo funcionan para ADMIN/RRHH, para otros roles se ignoran
- El paginado funciona con `page` y `pageSize` en query params
