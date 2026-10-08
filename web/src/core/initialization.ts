import type { ImageSize, Roi } from './roi'
import { pixelCount } from './image.ts'

export interface InitialLabels extends ImageSize {
  roi: Roi
  labels: Uint8Array
  foregroundCount: number
  backgroundCount: number
}

export function initializeLabels(size: ImageSize, roi: Roi): InitialLabels {
  const count = pixelCount(size)
  if (![roi.x, roi.y, roi.width, roi.height].every(Number.isSafeInteger)
    || roi.x < 0 || roi.y < 0 || roi.width <= 0 || roi.height <= 0
    || roi.x + roi.width > size.width || roi.y + roi.height > size.height) {
    throw new Error('La ROI debe tener área y estar dentro de la imagen.')
  }
  const foregroundCount = roi.width * roi.height
  if (foregroundCount === count) {
    throw new Error('Deja algo de fondo fuera de la ROI para inicializar GrabCut.')
  }
  const labels = new Uint8Array(count)
  for (let y = roi.y; y < roi.y + roi.height; y++) {
    const start = y * size.width + roi.x
    labels.fill(1, start, start + roi.width)
  }
  return {
    width: size.width,
    height: size.height,
    roi: { ...roi },
    labels,
    foregroundCount,
    backgroundCount: count - foregroundCount,
  }
}

// Display conversion only: the numerical labels remain 0 and 1.
export function labelsToRgba(labels: Uint8Array, size: ImageSize): Uint8ClampedArray {
  if (labels.length !== pixelCount(size)) throw new Error('La máscara no coincide con las dimensiones de la imagen.')
  const rgba = new Uint8ClampedArray(labels.length * 4)
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] !== 0 && labels[i] !== 1) throw new Error('La máscara solo admite etiquetas 0 y 1.')
    const value = labels[i] * 255
    rgba[i * 4] = value
    rgba[i * 4 + 1] = value
    rgba[i * 4 + 2] = value
    rgba[i * 4 + 3] = 255
  }
  return rgba
}
