# Manual de Usuario — Sistema de Gestión de Vacaciones CNI

**Organización:** Consejo Nacional de Inversiones (CNI), Honduras  
**Versión:** 1.1 · **Junio 2026**

Este manual describe cómo usar la plataforma web de vacaciones y permisos según su rol en la organización.

---

## 1. Acceso al sistema

### Iniciar sesión

1. Abra el navegador y vaya a la URL de la aplicación (por ejemplo `https://vacaciones.cni.hn`).
2. Ingrese su **correo institucional** y **contraseña**.
3. Si es su primer acceso tras una importación masiva, el sistema le pedirá **cambiar la contraseña** antes de continuar.

### Cerrar sesión

Use el menú de usuario (esquina superior) y seleccione **Cerrar sesión**.

### Problemas comunes

| Problema | Solución |
|----------|----------|
| "Credenciales inválidas" | Verifique correo y contraseña; tras 5 intentos fallidos la cuenta se bloquea 15 minutos |
| Sesión expirada | Vuelva a iniciar sesión; la duración depende de la política de RRHH/TI |
| Página en mantenimiento | Solo administradores pueden acceder; espere aviso de TI |

---

## 2. Roles y permisos

| Rol | Qué puede hacer |
|-----|-----------------|
| **Empleado** | Crear y consultar sus solicitudes, ver su balance detallado, editar su perfil |
| **Jefe** | Todo lo anterior + aprobar/rechazar solicitudes de su equipo, ver reportes de departamento |
| **Director** | Como jefe; puede enviar solicitudes propias con VoBo del Ministro (salta aprobación de jefe) |
| **RRHH** | Gestión de usuarios, departamentos, asignación de días, aprobación final, reportes globales |
| **Administrador** | Configuración del sistema, auditoría, acceso total |

El menú lateral muestra solo las opciones disponibles para su rol.

---

## 3. Empleado — Guía paso a paso

### Ver mi balance de días

1. Entre al **Dashboard** (`/dashboard`) o a **Mi Balance** (`/mi-balance`) en el menú Personal.
2. Revise la tabla con:
   - **Días vencidos** — saldo inicial del año laboral
   - **Días proporcionales** — días acumulados por antigüedad en el periodo
   - **Días disponibles** — saldo que puede usar hoy (inicial + proporcionales − usados − pendientes)

> El día libre por cumpleaños **no descuenta** de estos días de vacaciones.

### Crear una solicitud

1. Vaya a **Solicitudes** → **Nueva solicitud** (`/solicitudes/nueva`).
2. Seleccione el **tipo**:
   - **Vacaciones** — requiere días disponibles en su balance
   - **Permiso de salida** — 1–2 h, 2–4 h o día completo
   - **Licencia médica** — adjunte constancia médica (PDF o imagen)
   - **Permiso personal** — otros permisos autorizados
   - **Día libre por cumpleaños** — 1 día al año, solo en el mes en que cumple años (ver sección siguiente)
3. Indique **fechas de inicio y fin** (o fecha y duración para permisos por horas).
4. El sistema calcula automáticamente los **días hábiles** (excluye fines de semana).
5. Agregue **motivo** y, si aplica, **adjuntos**.
6. Pulse **Enviar solicitud**.

> Al enviar vacaciones o permiso de día completo, los días se **reservan** de su saldo hasta que RRHH apruebe o alguien rechace/cancele.

### Día libre por cumpleaños

Beneficio de **1 día libre al año**, distinto del saldo de vacaciones.

| Requisito | Detalle |
|-----------|---------|
| Fecha de nacimiento | Debe estar registrada en el sistema (RRHH la carga en Usuarios) |
| Cuándo solicitarlo | Solo durante el **mes de su cumpleaños** |
| Cuántas veces | **Una vez por año calendario** |
| Descuento de vacaciones | **No** — no afecta su balance de días de vacaciones |
| Adjuntos | No requiere VoBo del Ministro aunque usted sea director |

**Pasos:**

1. En **Nueva solicitud**, elija **Día libre por cumpleaños**.
2. Lea el mensaje de elegibilidad (indica si puede solicitarlo o el motivo por el que no).
3. Seleccione la **fecha del día libre** (debe caer en su mes de cumpleaños).
4. Envíe la solicitud; sigue el flujo normal de aprobación (jefe → RRHH).

**Motivos por los que no puede solicitarlo:**

- No tiene fecha de nacimiento registrada
- No estamos en su mes de cumpleaños
- Ya utilizó su día libre por cumpleaños este año (solicitud pendiente, aprobada o finalizada)

### Consultar el estado de mis solicitudes

1. Vaya a **Solicitudes** (`/solicitudes`).
2. Cada fila muestra el **estado** con color:
   - Amarillo — pendiente de jefe
   - Azul — aprobada por jefe, pendiente RRHH
   - Verde — aprobada por RRHH
   - Rojo — rechazada
   - Gris — cancelada o finalizada

### Cancelar una solicitud

Solo puede cancelar solicitudes **propias** que aún no estén finalizadas. Use el botón **Cancelar** en el detalle de la solicitud. Los días reservados vuelven a su saldo.

### Mi perfil

En **Mi perfil** (`/mi-perfil`) puede actualizar datos de contacto y cambiar su contraseña.

---

## 4. Jefe / Director — Aprobaciones

### Bandeja de aprobación

1. Vaya a **Aprobar solicitudes** (`/aprobar-solicitudes`).
2. Verá solicitudes **pendientes de su departamento** (no las propias — un jefe no puede aprobarse a sí mismo).
3. Abra una solicitud, revise fechas, motivo y adjuntos.
4. Elija **Aprobar** o **Rechazar** (indique motivo si rechaza).

Tras su aprobación, la solicitud pasa a **RRHH** para la decisión final.

### Mi equipo

En **Mi equipo** (`/mi-equipo`) consulte empleados a su cargo, sus balances y solicitudes activas.

### Reportes de departamento

En **Reportes departamento** (`/reportes-departamento`) exporte o consulte métricas de su área: ausencias, balances pendientes, solicitudes en curso.

### Solicitudes como Director

Si usted es **Director** y solicita vacaciones propias:

1. Adjunte el **VoBo del Ministro** al crear la solicitud.
2. Al enviar, la solicitud va directamente a estado **aprobada por jefe** (no pasa por otro jefe).
3. RRHH realiza la aprobación final.

---

## 5. RRHH — Gestión de personal

### Usuarios

1. **Usuarios** (`/usuarios`) — crear, editar o desactivar empleados.
2. Asigne **rol** (empleado, jefe, RRHH) y **departamento**.
3. Registre la **fecha de nacimiento** de cada colaborador; es obligatoria para habilitar el **día libre por cumpleaños**.
4. **Importar Excel**: descargue la plantilla, llene los datos y suba el archivo. Los usuarios importados reciben contraseña temporal y deben cambiarla al primer login.

### Departamentos

En **Departamentos** (`/departamentos`) administre la estructura organizacional y asigne jefe de cada área.

### Asignación de días

En **Asignación de días** (`/asignacion-dias`):

- **Individual:** asigne días iniciales según antigüedad (1 año = 10 días, 2 = 12, 3 = 15, 4+ = 20).
- **Masiva:** seleccione departamento, año laboral y operación (sumar, restar o reemplazar).

### Aprobación final (RRHH)

1. En **Aprobar solicitudes**, filtre las que están en estado **Aprobada Jefe**.
2. Verifique documentación y saldo.
3. **Aprobar RRHH** confirma el descuento definitivo de días.
4. **Rechazar** devuelve los días al empleado.

### Reportes globales

**Reportes** (`/reportes`) — balances, solicitudes, proyecciones, ausentismo. Exporte a PDF, CSV o Excel.

### Exportar datos

**Exportar** (`/exportar`) — descarga completa de usuarios, solicitudes y balances para respaldo o análisis externo.

---

## 6. Administrador — Sistema

### Configuración

En **Configuración** (`/configuracion`) ajuste parámetros sin reiniciar el servidor:

| Categoría | Ejemplos |
|-----------|----------|
| General | Nombre de la organización, año laboral activo |
| Vacaciones | Días mínimos/máimos, antigüedad |
| Notificaciones | Habilitar email, plantillas |
| Seguridad | Duración de sesión, complejidad de contraseña |
| Mantenimiento | Activar modo mantenimiento (bloquea usuarios no admin) |

### Auditoría

**Auditoría** (`/auditoria`) — registro de inicios de sesión, aprobaciones, cambios de configuración y acciones administrativas.

---

## 7. Flujo de aprobación (resumen visual)

```
Empleado crea solicitud
        │
        ▼
   ¿Es Director con VoBo?
    /        \
  Sí          No
   │           │
   │           ▼
   │    Pendiente Jefe
   │           │
   └─────┬─────┘
         ▼
   Aprobada Jefe
         │
         ▼
   RRHH aprueba / rechaza
         │
         ▼
   Finalizada (automático al pasar fecha fin)
```

---

## 8. Tipos de solicitud y requisitos

| Tipo | Requisitos |
|------|------------|
| Vacaciones | Saldo suficiente; fechas hábiles |
| Permiso salida (1–2 h / 2–4 h) | Fecha y horario; no descuenta días de vacaciones |
| Permiso día completo | Un día hábil |
| Licencia médica | Constancia médica obligatoria (PDF/JPG/PNG) |
| Permiso personal | Según política interna CNI |
| Día libre por cumpleaños | Fecha de nacimiento registrada; solo en el mes de cumpleaños; 1 vez al año; no descuenta vacaciones |

**Adjuntos permitidos:** PDF, PNG, JPG — máximo según configuración del sistema.

---

## 9. Preguntas frecuentes

**¿Por qué mis días disponibles bajaron al enviar una solicitud?**  
Los días de **vacaciones** (y permiso de salida de día completo) se reservan al enviar. Si RRHH rechaza o usted cancela, vuelven a estar disponibles. El **día libre por cumpleaños** no reserva ni descuenta días de vacaciones.

**¿Por qué no puedo solicitar el día libre por cumpleaños?**  
Verifique que RRHH tenga su fecha de nacimiento, que estemos en su mes de cumpleaños y que no haya usado ya ese beneficio este año.

**¿Cuándo se descuentan definitivamente?**  
Cuando RRHH aprueba la solicitud.

**¿Puedo editar una solicitud enviada?**  
No. Debe cancelarla y crear una nueva si aún está permitido.

**¿Quién recibe correos de notificación?**  
Depende de la configuración de RRHH/TI. Por defecto el email puede estar deshabilitado; consulte con soporte.

**¿Qué pasa si olvido mi contraseña?**  
Contacte a RRHH o TI para restablecerla (no hay recuperación automática por email en la versión actual).

---

## 10. Soporte

Para incidencias técnicas o acceso al sistema, contacte al área de Tecnología e Innovación del CNI.

---

*Manual de usuario v1.1 — Sistema de Gestión de Vacaciones CNI Honduras*
