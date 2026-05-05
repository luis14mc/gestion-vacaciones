const fs = require('fs');
const path = require('path');

const words = {
  'codigo': 'código',
  'descripcion': 'descripción',
  'telefono': 'teléfono',
  'miercoles': 'miércoles',
  'sabado': 'sábado',
  'historico': 'histórico',
  'exito': 'éxito',
  'opcion': 'opción',
  'configuracion': 'configuración',
  'informacion': 'información',
  'asignacion': 'asignación',
  'notificacion': 'notificación',
  'dias': 'días',
  'accion': 'acción',
  'basico': 'básico',
  'unico': 'único',
  'ultimo': 'último',
  'proximo': 'próximo',
  'maximo': 'máximo',
  'minimo': 'mínimo',
  'numero': 'número',
  'tecnico': 'técnico',
  'politica': 'política'
};

const regex = new RegExp('\\b(' + Object.keys(words).join('|') + ')\\b', 'gi');

function searchFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!['node_modules', '.next', 'dist', '.git', 'assets'].includes(file)) {
        searchFiles(fullPath);
      }
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        const matches = [...line.matchAll(regex)];
        for (const m of matches) {
           const word = m[0];
           // Ensure it's likely part of text or string
           if (word === word.toLowerCase()) {
               if (!line.includes(`"${word}`) && !line.includes(`'${word}`) && !line.includes(`>${word}`)) continue;
           }
           
           if (line.includes('\"') || line.includes('`') || line.includes('>') || line.includes('\'')) {
             console.log(fullPath + ':' + (i+1) + ' -> ' + line.trim());
           }
        }
      });
    }
  }
}

searchFiles('c:/Desarrollo/gestion-vacaciones/src');
