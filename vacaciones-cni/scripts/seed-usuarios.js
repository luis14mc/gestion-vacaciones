import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Configurar dotenv para cargar .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL no está definida en .env.local');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function seedUsuarios() {
  console.log('🌱 Iniciando seed de usuarios reales...\n');

  try {
    // Primero obtenemos los departamentos
    const departamentos = await sql`
      SELECT id, nombre FROM departamentos ORDER BY id LIMIT 4
    `;

    console.log('📂 Departamentos disponibles:', departamentos.map(d => `${d.id}: ${d.nombre}`).join(', '));

    if (departamentos.length < 4) {
      console.error('❌ Error: Se necesitan al menos 4 departamentos en la BD');
      process.exit(1);
    }

    // Datos de usuarios reales
    const usuarios = [
      {
        email: 'soporteit@cni.hn',
        password: 'Admin123',
        nombre: 'Soporte',
        apellido: 'IT',
        departamento_id: departamentos[0].id,
        cargo: 'Administrador del Sistema',
        es_admin: true,
        es_rrhh: false,
        es_jefe: false,
        dias_vacaciones: 30
      },
      {
        email: 'ygarcia@cni.hn',
        password: 'RRHH123',
        nombre: 'Yessenia',
        apellido: 'García',
        departamento_id: departamentos[1].id,
        cargo: 'Jefe de Recursos Humanos',
        es_admin: false,
        es_rrhh: true,
        es_jefe: true,
        dias_vacaciones: 30
      },
      {
        email: 'ecarrasco@cni.hn',
        password: 'Jefe123',
        nombre: 'Eduardo',
        apellido: 'Carrasco',
        departamento_id: departamentos[2].id,
        cargo: 'Jefe de Departamento',
        es_admin: false,
        es_rrhh: false,
        es_jefe: true,
        dias_vacaciones: 30
      },
      {
        email: 'amartinez@cni.hn',
        password: 'Empleado123',
        nombre: 'Ana',
        apellido: 'Martínez',
        departamento_id: departamentos[3].id,
        cargo: 'Contador',
        es_admin: false,
        es_rrhh: false,
        es_jefe: false,
        dias_vacaciones: 15
      }
    ];

    console.log('\n🔐 Hasheando contraseñas...');
    
    for (const usuario of usuarios) {
      const hashedPassword = await bcrypt.hash(usuario.password, 10);
      
      // Verificar si el usuario ya existe
      const existente = await sql`
        SELECT id, email FROM usuarios WHERE email = ${usuario.email}
      `;

      if (existente.length > 0) {
        // Actualizar usuario existente
        console.log(`\n♻️  Actualizando usuario: ${usuario.email}`);
        
        await sql`
          UPDATE usuarios 
          SET 
            password_hash = ${hashedPassword},
            nombre = ${usuario.nombre},
            apellido = ${usuario.apellido},
            departamento_id = ${usuario.departamento_id},
            cargo = ${usuario.cargo},
            es_admin = ${usuario.es_admin},
            es_rrhh = ${usuario.es_rrhh},
            es_jefe = ${usuario.es_jefe},
            activo = true,
            updated_at = NOW()
          WHERE email = ${usuario.email}
        `;

        // Nota: Los balances se manejan en la tabla balances_ausencias con tipos_ausencia_config
        console.log(`   💼 Balance sugerido: ${usuario.dias_vacaciones} días (configurar manualmente vía RRHH)`);

        console.log(`   ✅ Usuario actualizado: ${usuario.nombre} ${usuario.apellido}`);
        console.log(`   📧 Email: ${usuario.email}`);
        console.log(`   🔑 Password: ${usuario.password}`);
        console.log(`   👤 Rol: ${usuario.es_admin ? 'Admin' : usuario.es_rrhh ? 'RRHH' : usuario.es_jefe ? 'Jefe' : 'Empleado'}`);
        console.log(`   📂 Departamento: ${departamentos.find(d => d.id === usuario.departamento_id)?.nombre}`);

      } else {
        // Insertar nuevo usuario
        console.log(`\n➕ Insertando usuario: ${usuario.email}`);
        
        const [nuevoUsuario] = await sql`
          INSERT INTO usuarios (
            email, password_hash, nombre, apellido, departamento_id, 
            cargo, es_admin, es_rrhh, es_jefe, activo
          ) VALUES (
            ${usuario.email}, ${hashedPassword}, ${usuario.nombre}, ${usuario.apellido},
            ${usuario.departamento_id}, ${usuario.cargo}, ${usuario.es_admin}, 
            ${usuario.es_rrhh}, ${usuario.es_jefe}, true
          )
          RETURNING id, email, nombre, apellido
        `;

        // Nota: Los balances se manejan en balances_ausencias
        console.log(`   ✅ Usuario creado: ${nuevoUsuario.nombre} ${nuevoUsuario.apellido} (ID: ${nuevoUsuario.id})`);
        console.log(`   📧 Email: ${usuario.email}`);
        console.log(`   🔑 Password: ${usuario.password}`);
        console.log(`   👤 Rol: ${usuario.es_admin ? 'Admin' : usuario.es_rrhh ? 'RRHH' : usuario.es_jefe ? 'Jefe' : 'Empleado'}`);
        console.log(`   📂 Departamento: ${departamentos.find(d => d.id === usuario.departamento_id)?.nombre}`);
        console.log(`   💼 Balance sugerido: ${usuario.dias_vacaciones} días (configurar vía RRHH)`);
      }
    }

    // Mostrar resumen final
    console.log('\n' + '='.repeat(70));
    console.log('✅ SEED COMPLETADO - Usuarios de prueba creados/actualizados');
    console.log('='.repeat(70));
    console.log('\n📋 Credenciales de acceso:\n');
    console.log('👑 ADMIN:');
    console.log('   Email: soporteit@cni.hn');
    console.log('   Password: Admin123');
    console.log('\n👔 RECURSOS HUMANOS:');
    console.log('   Email: ygarcia@cni.hn');
    console.log('   Password: RRHH123');
    console.log('\n👨‍💼 JEFE DE DEPARTAMENTO:');
    console.log('   Email: ecarrasco@cni.hn');
    console.log('   Password: Jefe123');
    console.log('\n👤 EMPLEADO:');
    console.log('   Email: amartinez@cni.hn');
    console.log('   Password: Empleado123');
    console.log('\n' + '='.repeat(70));

    // Verificación final
    const totalUsuarios = await sql`SELECT COUNT(*) as total FROM usuarios WHERE activo = true`;
    console.log(`\n📊 Total de usuarios activos en la BD: ${totalUsuarios[0].total}`);

  } catch (error) {
    console.error('\n❌ Error durante el seed:', error);
    process.exit(1);
  }
}

// Ejecutar el seed
seedUsuarios()
  .then(() => {
    console.log('\n✨ Proceso completado exitosamente\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
