import 'server-only'
import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  type ContainerClient,
} from '@azure/storage-blob'
import type { Carpeta } from '@/lib/archivos/matriz'

const SAS_LECTURA_MIN = 5
const SAS_ESCRITURA_MIN = 10

let servicio: BlobServiceClient | null = null

function getServicio(): BlobServiceClient {
  if (servicio) return servicio
  const conexion = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!conexion) {
    throw new Error('Falta AZURE_STORAGE_CONNECTION_STRING en el servidor.')
  }
  servicio = BlobServiceClient.fromConnectionString(conexion)
  return servicio
}

export function getContenedor(carpeta: Carpeta): ContainerClient {
  return getServicio().getContainerClient(carpeta)
}

function getCredencial(): StorageSharedKeyCredential {
  const credencial = getServicio().credential
  if (!(credencial instanceof StorageSharedKeyCredential)) {
    throw new Error('La cadena de conexión debe incluir AccountKey.')
  }
  return credencial
}

/** URL firmada de corta duración para un solo blob. Nunca se reutiliza la clave de la cuenta fuera del servidor. */
export function crearUrlFirmada(
  carpeta: Carpeta,
  blob: string,
  modo: 'lectura' | 'escritura',
  nombreDescarga?: string
): string {
  const contenedor = getContenedor(carpeta)
  const minutos = modo === 'lectura' ? SAS_LECTURA_MIN : SAS_ESCRITURA_MIN
  const ahora = Date.now()
  const sas = generateBlobSASQueryParameters(
    {
      containerName: carpeta,
      blobName: blob,
      permissions: BlobSASPermissions.parse(modo === 'lectura' ? 'r' : 'cw'),
      startsOn: new Date(ahora - 60_000),
      expiresOn: new Date(ahora + minutos * 60_000),
      contentDisposition:
        modo === 'lectura'
          ? `attachment; filename*=UTF-8''${encodeURIComponent(nombreDescarga ?? blob)}`
          : undefined,
    },
    getCredencial()
  ).toString()
  return `${contenedor.getBlobClient(blob).url}?${sas}`
}
