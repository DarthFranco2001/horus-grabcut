import type { ImageSize } from './roi'

export interface GrayscaleImage extends ImageSize {
  pixels: Uint8Array
}

export function pixelCount(size: ImageSize): number {
  const count = size.width * size.height
  if (!Number.isSafeInteger(size.width) || !Number.isSafeInteger(size.height)
    || size.width <= 0 || size.height <= 0 || !Number.isSafeInteger(count)) {
    throw new Error('Las dimensiones de la imagen deben ser enteros positivos.')
  }
  return count
}

export function rgbaToGrayscale(rgba: Uint8ClampedArray | Uint8Array, size: ImageSize): GrayscaleImage {
  const count = pixelCount(size)
  if (rgba.length !== count * 4) throw new Error('Los píxeles no coinciden con las dimensiones de la imagen.')
  const pixels = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    const offset = i * 4
    if (rgba[offset + 3] !== 255) throw new Error('La imagen debe ser opaca para leer sus intensidades.')
    // Equal RGB channels (the repository's grayscale PNGs) are preserved exactly.
    pixels[i] = Math.round((299 * rgba[offset] + 587 * rgba[offset + 1] + 114 * rgba[offset + 2]) / 1000)
  }
  return { width: size.width, height: size.height, pixels }
}
