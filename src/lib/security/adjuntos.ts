/**
 * Validación de adjuntos de solicitudes (OWASP — carga de archivos).
 *
 * Los adjuntos llegan como base64 (o data URL) en el cuerpo JSON. Sin
 * validación, un usuario podía enviar archivos de cualquier tamaño y tipo
 * (incluido contenido malicioso o mislabeled). Aquí se valida:
 *  - número máximo de archivos y tamaño (por archivo y total),
 *  - base64 bien formado,
 *  - tipo real por FIRMA (magic number), no por la extensión/tipo declarado.
 *
 * Se permiten solo PDF e imágenes (JPG/PNG/WEBP), suficiente para correos
 * de VoBo y justificantes médicos.
 */

export const MAX_ARCHIVOS = 5;
export const MAX_BYTES_ARCHIVO = 5 * 1024 * 1024; // 5 MB
export const MAX_BYTES_TOTAL = 15 * 1024 * 1024; // 15 MB

interface FirmaArchivo {
  mime: string;
  test: (b: Buffer) => boolean;
}

const FIRMAS: FirmaArchivo[] = [
  { mime: 'application/pdf', test: (b) => b.slice(0, 4).toString('latin1') === '%PDF' },
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    test: (b) =>
      b.length >= 8 &&
      b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/webp',
    test: (b) =>
      b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP',
  },
];

function extraerBase64(data: string): string | null {
  if (data.startsWith('data:')) {
    const idx = data.indexOf('base64,');
    if (idx === -1) return null;
    return data.slice(idx + 7);
  }
  return data;
}

function bytesDeBase64(b64: string): number {
  const len = b64.length;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

type Adjunto = { nombre?: string; data?: unknown; tipo?: string };

/**
 * @returns null si todos los adjuntos son válidos; un mensaje si no.
 */
export function validarAdjuntos(adjuntos: unknown): string | null {
  if (adjuntos == null) return null;
  if (!Array.isArray(adjuntos)) return 'Formato de adjuntos inválido.';
  if (adjuntos.length === 0) return null;
  if (adjuntos.length > MAX_ARCHIVOS) {
    return `Se permiten máximo ${MAX_ARCHIVOS} archivos adjuntos.`;
  }

  let total = 0;
  for (const item of adjuntos as Adjunto[]) {
    const nombre = item?.nombre || 'archivo';
    if (!item?.data || typeof item.data !== 'string') {
      return `El adjunto "${nombre}" no tiene contenido válido.`;
    }

    const b64Raw = extraerBase64(item.data);
    if (!b64Raw) return `El adjunto "${nombre}" tiene un formato inválido.`;
    const b64 = b64Raw.replace(/\s/g, '');
    if (b64.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
      return `El adjunto "${nombre}" no es base64 válido.`;
    }

    const size = bytesDeBase64(b64);
    if (size > MAX_BYTES_ARCHIVO) {
      return `El archivo "${nombre}" supera el tamaño máximo de 5 MB.`;
    }
    total += size;

    let cabecera: Buffer;
    try {
      cabecera = Buffer.from(b64.slice(0, 24), 'base64');
    } catch {
      return `El archivo "${nombre}" no se pudo leer.`;
    }

    const detectado = FIRMAS.find((f) => f.test(cabecera));
    if (!detectado) {
      return `El archivo "${nombre}" no es de un tipo permitido (PDF, JPG, PNG o WEBP).`;
    }
  }

  if (total > MAX_BYTES_TOTAL) {
    return 'El tamaño total de los adjuntos supera el máximo de 15 MB.';
  }

  return null;
}
