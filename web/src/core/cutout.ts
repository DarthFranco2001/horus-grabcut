import { pixelCount } from './image.ts'
import type { GrayscaleImage } from './image'

// Preserve the original intensities and coordinates; only the background becomes transparent.
export function cutoutToRgba(image: GrayscaleImage, labels: Uint8Array): Uint8ClampedArray {
  const count = pixelCount(image)
  if (image.pixels.length !== count || labels.length !== count) {
    throw new Error('La imagen y la máscara deben tener las mismas dimensiones.')
  }
  const rgba = new Uint8ClampedArray(count * 4)
  for (let i = 0; i < count; i++) {
    if (labels[i] !== 0 && labels[i] !== 1) throw new Error('La máscara solo admite etiquetas 0 y 1.')
    if (labels[i] === 0) continue
    const value = image.pixels[i]
    rgba.set([value, value, value, 255], i * 4)
  }
  return rgba
}
