import type { ImageSize } from '../core/roi'
import { extractGroundTruth } from '../core/evaluation.ts'

export async function loadGroundTruth(url: string, size: ImageSize, signal: AbortSignal) {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('No se pudo cargar la anotación de referencia.')
  const bitmap = await createImageBitmap(await response.blob())
  try {
    signal.throwIfAborted()
    if (bitmap.width !== size.width || bitmap.height !== size.height) {
      throw new Error('La referencia tiene un tamaño diferente al de la imagen. No se puede comparar.')
    }
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('No se pudo leer la anotación de referencia.')
    context.drawImage(bitmap, 0, 0)
    const { data } = context.getImageData(0, 0, size.width, size.height)
    return extractGroundTruth(data, size)
  } finally {
    bitmap.close()
  }
}
