# 📋 Día 2 - Actividad 2.4: Notificaciones y Auditoría de Cambios

## 🎯 Objetivo
Implementar sistema de notificaciones por correo electrónico y auditoría completa de cambios de estado en las solicitudes de vacaciones.

---

## 📝 Requisitos Funcionales

### 1. Sistema de Notificaciones por Email
- **Creación de solicitud:** Notificar al JEFE del departamento
- **Aprobación JEFE:** Notificar a RRHH y al empleado
- **Aprobación RRHH:** Notificar al empleado (aprobación final)
- **Rechazo:** Notificar al empleado con motivo
- **Cancelación:** Notificar a JEFE y RRHH si aplica

### 2. Auditoría de Cambios
- Registro de todos los cambios de estado
- Metadatos: quién, cuándo, estado anterior, estado nuevo
- Razón del cambio (especialmente rechazos)
- Historial completo visible en el sistema

---

## 🗄️ Estructura de Base de Datos

### Tabla: `solicitudes_historial`
```sql
CREATE TABLE solicitudes_historial (
  id SERIAL PRIMARY KEY,
  solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id), -- Quién realizó el cambio
  accion VARCHAR(50) NOT NULL, -- 'crear', 'aprobar_jefe', 'aprobar_rrhh', 'rechazar', 'cancelar'
  estado_anterior VARCHAR(20),
  estado_nuevo VARCHAR(20) NOT NULL,
  comentario TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_solicitudes_historial_solicitud ON solicitudes_historial(solicitud_id);
CREATE INDEX idx_solicitudes_historial_usuario ON solicitudes_historial(usuario_id);
CREATE INDEX idx_solicitudes_historial_fecha ON solicitudes_historial(created_at);
```

### Configuración Email
```typescript
// En .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@vacaciones-cni.hn
```

---

## 🔧 Implementación

### Paso 1: Crear migración de base de datos
```bash
# Archivo: migrations/004_historial_solicitudes.sql
```

### Paso 2: Configurar servicio de email
```bash
pnpm add nodemailer
pnpm add -D @types/nodemailer
```

### Paso 3: Crear servicio de notificaciones
- `src/services/email.service.ts` - Envío de emails
- `src/services/notificaciones.service.ts` - Plantillas y lógica
- `src/services/historial.service.ts` - Auditoría

### Paso 4: Integrar en endpoints existentes
- Modificar POST /api/solicitudes
- Modificar PATCH /api/solicitudes
- Crear GET /api/solicitudes/:id/historial

---

## 📋 Casos de Prueba

### Caso 1: Notificación al crear solicitud
**Escenario:** EMPLEADO crea solicitud de vacaciones  
**Email esperado:** JEFE recibe notificación con detalles  
**Verificación:** 
- Email enviado al JEFE del departamento
- Contiene: empleado, fechas, días solicitados
- Link para aprobar/rechazar

### Caso 2: Notificación de aprobación JEFE
**Escenario:** JEFE aprueba solicitud  
**Email esperado:** 
- EMPLEADO recibe confirmación de primera aprobación
- RRHH recibe notificación para revisión final  
**Verificación:**
- 2 emails enviados
- Incluye estado actual y próximo paso

### Caso 3: Notificación de aprobación final RRHH
**Escenario:** RRHH aprueba solicitud  
**Email esperado:** EMPLEADO recibe confirmación final  
**Verificación:**
- Email indica aprobación definitiva
- Incluye fechas y días aprobados

### Caso 4: Notificación de rechazo
**Escenario:** JEFE o RRHH rechaza solicitud  
**Email esperado:** EMPLEADO recibe notificación con motivo  
**Verificación:**
- Email explica razón del rechazo
- Incluye quién rechazó y cuándo

### Caso 5: Auditoría completa
**Escenario:** Consultar historial de una solicitud  
**Respuesta esperada:** 
```json
{
  "success": true,
  "historial": [
    {
      "id": 1,
      "accion": "crear",
      "estadoAnterior": null,
      "estadoNuevo": "pendiente",
      "usuario": "Juan Pérez",
      "fecha": "2026-01-08T10:00:00Z"
    },
    {
      "id": 2,
      "accion": "aprobar_jefe",
      "estadoAnterior": "pendiente",
      "estadoNuevo": "aprobada_jefe",
      "usuario": "María García (JEFE)",
      "fecha": "2026-01-08T14:30:00Z"
    },
    {
      "id": 3,
      "accion": "aprobar_rrhh",
      "estadoAnterior": "aprobada_jefe",
      "estadoNuevo": "aprobada",
      "usuario": "Ana López (RRHH)",
      "fecha": "2026-01-08T16:00:00Z"
    }
  ]
}
```

### Caso 6: Metadata completa
**Verificación:** Cada registro de historial incluye:
- ID de solicitud
- Usuario que realizó la acción
- Timestamps precisos
- IP address (opcional)
- User agent (opcional)

---

## ✅ Checklist de Implementación

### Base de Datos
- [ ] Crear tabla `solicitudes_historial`
- [ ] Crear índices para optimización
- [ ] Verificar foreign keys y cascadas

### Servicios
- [ ] Configurar Nodemailer
- [ ] Crear servicio de email con plantillas HTML
- [ ] Crear servicio de historial
- [ ] Implementar funciones de notificación por tipo

### Integración
- [ ] Modificar POST /api/solicitudes (notificar JEFE)
- [ ] Modificar PATCH aprobar_jefe (notificar EMPLEADO y RRHH)
- [ ] Modificar PATCH aprobar_rrhh (notificar EMPLEADO)
- [ ] Modificar PATCH rechazar (notificar EMPLEADO con motivo)
- [ ] Crear GET /api/solicitudes/:id/historial

### Frontend
- [ ] Crear componente HistorialSolicitud
- [ ] Mostrar timeline de cambios
- [ ] Agregar botón "Ver Historial" en solicitudes
- [ ] Modal con historial completo

### Testing
- [ ] Probar envío de emails en desarrollo (Ethereal/Mailtrap)
- [ ] Verificar todos los casos de notificación
- [ ] Validar estructura de historial
- [ ] Probar permisos de acceso a historial

---

## 🎨 Plantillas de Email

### Template: Nueva Solicitud
```
Asunto: Nueva Solicitud de Vacaciones - [Empleado]

Hola [JEFE],

[Empleado] ha solicitado vacaciones:

📅 Fecha inicio: [fecha_inicio]
📅 Fecha fin: [fecha_fin]
📊 Días solicitados: [cantidad] días laborables

🔗 Revisar solicitud: [link_aprobar]

---
Sistema de Gestión de Vacaciones CNI
```

### Template: Aprobación JEFE
```
Asunto: Tu solicitud ha sido aprobada por tu Jefe

Hola [Empleado],

Tu solicitud de vacaciones ha sido aprobada por [JEFE].

📅 Fechas: [fecha_inicio] - [fecha_fin]
✅ Estado: Aprobada por Jefe (Pendiente RRHH)

La solicitud está ahora en revisión por Recursos Humanos para aprobación final.

---
Sistema de Gestión de Vacaciones CNI
```

### Template: Aprobación Final
```
Asunto: ¡Vacaciones Aprobadas! ✅

Hola [Empleado],

¡Buenas noticias! Tu solicitud de vacaciones ha sido APROBADA.

📅 Fechas: [fecha_inicio] - [fecha_fin]
📊 Días: [cantidad] días laborables
✅ Estado: APROBADA

Disfruta tus vacaciones.

---
Sistema de Gestión de Vacaciones CNI
```

### Template: Rechazo
```
Asunto: Solicitud de Vacaciones Rechazada

Hola [Empleado],

Tu solicitud de vacaciones ha sido rechazada.

📅 Fechas solicitadas: [fecha_inicio] - [fecha_fin]
❌ Rechazada por: [usuario]
📝 Motivo: [motivo_rechazo]

Por favor contacta con tu supervisor para más información.

---
Sistema de Gestión de Vacaciones CNI
```

---

## 🔍 Endpoints API

### GET /api/solicitudes/:id/historial
**Descripción:** Obtener historial completo de cambios de una solicitud  
**Autenticación:** Requerida  
**Permisos:** 
- EMPLEADO: solo su propia solicitud
- JEFE: solicitudes de su departamento
- RRHH/ADMIN: todas

**Response:**
```json
{
  "success": true,
  "solicitud": {
    "id": 1,
    "codigo": "SOL-2026-00001",
    "usuario": "Juan Pérez",
    "estado": "aprobada"
  },
  "historial": [
    {
      "id": 1,
      "accion": "crear",
      "estadoAnterior": null,
      "estadoNuevo": "pendiente",
      "usuario": {
        "id": 3,
        "nombre": "Juan Pérez",
        "rol": "Empleado"
      },
      "comentario": null,
      "createdAt": "2026-01-08T10:00:00Z"
    }
  ]
}
```

---

## 📅 Tiempo Estimado
- Migración DB: 10 min
- Configuración email: 15 min
- Servicios backend: 1 hora
- Integración endpoints: 30 min
- Frontend historial: 45 min
- Testing: 30 min
- **Total:** ~3 horas

---

## 🚀 Criterios de Aceptación

1. ✅ **Notificaciones funcionan** en todos los casos
2. ✅ **Emails tienen formato HTML** profesional
3. ✅ **Historial registra** todos los cambios
4. ✅ **Permisos de acceso** respetan RBAC
5. ✅ **Timeline visual** en frontend
6. ✅ **Configuración flexible** para diferentes proveedores SMTP
7. ✅ **Logs de envío** para debugging

---

## 📌 Siguiente Paso
Una vez completada esta actividad, continuar con:
- **Actividad 3.1:** Reportes avanzados y exportación
- **Actividad 3.2:** Integración con calendario externo
