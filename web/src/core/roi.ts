export interface Point {
  x: number
  y: number
}

export interface ImageSize {
  width: number
  height: number
}

export interface Roi extends Point, ImageSize {}

export interface DisplayBounds extends ImageSize {
  left: number
  top: number
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Points describe pixel boundaries: x + width and y + height are exclusive.
export function createRoi(start: Point, end: Point, size: ImageSize): Roi | null {
  if (![start.x, start.y, end.x, end.y, size.width, size.height].every(Number.isFinite)
    || size.width <= 0 || size.height <= 0) return null

  const x1 = clamp(Math.round(start.x), 0, size.width)
  const y1 = clamp(Math.round(start.y), 0, size.height)
  const x2 = clamp(Math.round(end.x), 0, size.width)
  const y2 = clamp(Math.round(end.y), 0, size.height)
  const width = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)

  if (width === 0 || height === 0) return null
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width, height }
}

export function imagePoint(point: Point, bounds: DisplayBounds, size: ImageSize): Point | null {
  if (bounds.width <= 0 || bounds.height <= 0) return null
  return {
    x: (point.x - bounds.left) * size.width / bounds.width,
    y: (point.y - bounds.top) * size.height / bounds.height,
  }
}

export function moveRoi(roi: Roi, delta: Point, size: ImageSize): Roi {
  return {
    ...roi,
    x: clamp(Math.round(roi.x + delta.x), 0, size.width - roi.width),
    y: clamp(Math.round(roi.y + delta.y), 0, size.height - roi.height),
  }
}

export function resizeRoi(roi: Roi, corner: Corner, point: Point, size: ImageSize): Roi | null {
  const opposite = {
    x: corner.endsWith('w') ? roi.x + roi.width : roi.x,
    y: corner.startsWith('n') ? roi.y + roi.height : roi.y,
  }
  return createRoi(opposite, point, size)
}
