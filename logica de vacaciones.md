## Lógica de Solicitudes de Vacaciones/Permisos

### Jerarquía de Aprobación (Estrictamente 2 niveles, culmina en RRHH)

La jerarquía organizacional es: **Oficiales (Empleados) → Jefes → Directores → Ministro (Máxima Autoridad)**.
La auto-aprobación está completamente eliminada. El aprobador final SIEMPRE es Recursos Humanos. El Secretario General ya no aprueba solicitudes.

| Rol | Descripción | Sus solicitudes | Aprueba a |
|-----|------------|-----------------|-----------|
| **Ministro** | Máxima autoridad | No aplica en el sistema | Da VoBo por correo a Directores |
| **Director** | Jefe de Jefes | Adjunta VoBo del Ministro → Pasa a RRHH (Final) | Jefes y Oficiales subordinados |
| **Jefe** | Jefe de Oficiales | Pasa a su Director → RRHH (Final) | Oficiales subordinados |
| **Oficial (Empleado)** | Personal operativo | Pasa a su Jefe Inmediato → RRHH (Final) | — |

---

### 1. Oficial (Empleado)

**Crear solicitud:**
- Crea solicitud → Estado: `pendiente_jefe`
- → Su **jefe superior** (Jefe o Director asignado) aprueba o rechaza
- → Si aprueba: pasa a estado `aprobada_jefe` y va a la bandeja de RRHH
- → Si RRHH aprueba: estado `aprobada_rrhh` (Estado Final - Finalizada)

### 2. Jefe

**Crear solicitud (propia):**
- Crea solicitud → Estado: `pendiente_jefe`
- → Su **Director** (jefe superior asignado) aprueba o rechaza
- → Si aprueba: pasa a estado `aprobada_jefe` y va a la bandeja de RRHH
- → Si RRHH aprueba: estado `aprobada_rrhh` (Estado Final - Finalizada)

**Aprobar solicitudes de Oficiales:**
- Ve solicitudes `pendiente_jefe` de usuarios que lo tienen como `jefe_superior_id`
- Aprobar → cambia a `aprobada_jefe` (pasa a RRHH)
- Rechazar → cambia a `rechazada_jefe`

### 3. Director

**Crear solicitud (propia):**
- Crea solicitud + **Adjunta obligatoriamente correo con el VoBo del Ministro** → Estado: `aprobada_jefe` (o similar que indique que va directo a RRHH)
- → Va directo a la bandeja de RRHH para validación del adjunto
- → Si RRHH aprueba: estado `aprobada_rrhh` (Estado Final - Finalizada)

**Aprobar solicitudes de Jefes u Oficiales:**
- Ve solicitudes `pendiente_jefe` de usuarios que lo tienen como `jefe_superior_id`
- Aprobar → cambia a `aprobada_jefe` (pasa a RRHH)
- Rechazar → cambia a `rechazada_jefe`

### 4. RRHH (Aprobador Final)

**Aprobar solicitudes:**
- Ve solicitudes en estado `aprobada_jefe` (ya sea porque las aprobó un Jefe/Director, o porque es de un Director que adjuntó el VoBo del Ministro).
- Aprobar → cambia a `aprobada_rrhh` (Finalizada y días deducidos en firme)
- Rechazar → cambia a `rechazada_rrhh` (Días devueltos al balance)

---

### Diagrama de estados

```
Oficial crea:  pendiente_jefe → (Jefe Inmediato) → aprobada_jefe → (RRHH) → aprobada_rrhh (FINAL)
Jefe crea:     pendiente_jefe → (Director)       → aprobada_jefe → (RRHH) → aprobada_rrhh (FINAL)
Director crea: Adjunta VoBo Ministro             → aprobada_jefe → (RRHH) → aprobada_rrhh (FINAL)
```

### Reglas de negocio implementadas

1. Cada usuario tiene un `jefe_superior_id` que indica quién aprueba sus solicitudes (excepto el Director, que usa el VoBo del Ministro).
2. Un Jefe NUNCA puede aprobar/rechazar su propia solicitud.
3. Un Director NUNCA puede aprobar/rechazar su propia solicitud.
4. Las solicitudes del Director requieren adjuntar el VoBo del Ministro al momento de la creación y van directo a RRHH.
5. El Secretario General YA NO es parte del flujo de aprobación.
6. RRHH siempre es el paso final de aprobación.
7. El listado de solicitudes para aprobar (Jefes/Directores) muestra solo las de subordinados directos (`jefe_superior_id = usuario actual`).
8. La cancelación de una solicitud (o su rechazo en cualquier paso) devuelve los días al balance inmediatamente.
