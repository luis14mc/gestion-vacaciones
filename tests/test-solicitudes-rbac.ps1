# 🧪 Script de Pruebas RBAC - GET /api/solicitudes
# Sistema de Gestión de Vacaciones - CNI
# Día 2, Actividad 2.1

$baseUrl = "http://localhost:3000"

Write-Host "`n🧪 INICIANDO PRUEBAS RBAC - GET /api/solicitudes" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# Función para hacer login y obtener cookies
function Login-User {
    param($email, $password)
    
    $loginUrl = "$baseUrl/api/auth/callback/credentials"
    $body = @{
        email = $email
        password = $password
    } | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest -Uri $loginUrl -Method POST -Body $body -ContentType "application/json" -SessionVariable session
        return $session
    } catch {
        Write-Host "❌ Error en login: $_" -ForegroundColor Red
        return $null
    }
}

# Función para obtener solicitudes
function Get-Solicitudes {
    param($session, $roleName)
    
    $url = "$baseUrl/api/solicitudes"
    
    Write-Host "`n📋 Probando GET /api/solicitudes como $roleName" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -WebSession $session
        $data = $response.Content | ConvertFrom-Json
        
        if ($data.success) {
            Write-Host "   ✅ Status: 200 OK" -ForegroundColor Green
            Write-Host "   📊 Total solicitudes: $($data.total)" -ForegroundColor Green
            Write-Host "   📄 En esta página: $($data.data.Count)" -ForegroundColor Green
            
            if ($data.data.Count -gt 0) {
                Write-Host "   👤 Usuarios en resultados:" -ForegroundColor Cyan
                $data.data | ForEach-Object {
                    Write-Host "      - Solicitud #$($_.id): $($_.usuario.nombre) $($_.usuario.apellido) ($($_.usuario.email))" -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "   ❌ Error: $($data.error)" -ForegroundColor Red
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   ❌ HTTP $statusCode" -ForegroundColor Red
        
        if ($statusCode -eq 401) {
            Write-Host "   🔒 No autenticado" -ForegroundColor Red
        } elseif ($statusCode -eq 403) {
            Write-Host "   🚫 Sin permisos (403 Forbidden)" -ForegroundColor Red
        }
    }
}

# ======================
# PRUEBA 1: ADMIN
# ======================
Write-Host "`n🔴 PRUEBA 1: ADMIN (debe ver TODAS las solicitudes)" -ForegroundColor Magenta
$adminSession = Login-User -email "admin@cni.hn" -password "Admin123!"
if ($adminSession) {
    Get-Solicitudes -session $adminSession -roleName "ADMIN"
}

# ======================
# PRUEBA 2: RRHH
# ======================
Write-Host "`n🟢 PRUEBA 2: RRHH (debe ver TODAS las solicitudes)" -ForegroundColor Magenta
$rrhhSession = Login-User -email "rrhh@cni.hn" -password "Admin123!"
if ($rrhhSession) {
    Get-Solicitudes -session $rrhhSession -roleName "RRHH"
}

# ======================
# PRUEBA 3: JEFE
# ======================
Write-Host "`n🟡 PRUEBA 3: JEFE (debe ver solo SUS solicitudes)" -ForegroundColor Magenta
$jefeSession = Login-User -email "jefe.tecnologia@cni.hn" -password "Admin123!"
if ($jefeSession) {
    Get-Solicitudes -session $jefeSession -roleName "JEFE"
}

# ======================
# PRUEBA 4: EMPLEADO
# ======================
Write-Host "`n🔵 PRUEBA 4: EMPLEADO (debe ver solo SUS solicitudes)" -ForegroundColor Magenta
$empleadoSession = Login-User -email "empleado@cni.hn" -password "Admin123!"
if ($empleadoSession) {
    Get-Solicitudes -session $empleadoSession -roleName "EMPLEADO"
}

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "✅ PRUEBAS COMPLETADAS" -ForegroundColor Cyan
Write-Host "`n💡 Resultados esperados:" -ForegroundColor Yellow
Write-Host "   - ADMIN y RRHH: Ven TODAS las solicitudes" -ForegroundColor Gray
Write-Host "   - JEFE y EMPLEADO: Ven solo SUS propias solicitudes" -ForegroundColor Gray
Write-Host ""
