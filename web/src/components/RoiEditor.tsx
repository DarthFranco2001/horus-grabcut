import { useId, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { Box, Button, Text } from 'grommet'
import { createRoi, imagePoint, moveRoi, resizeRoi } from '../core/roi'
import type { Corner, ImageSize, Point, Roi } from '../core/roi'
import './RoiEditor.css'

interface RoiEditorProps {
  src: string
  caseId: string
  roi: Roi | null
  onChange: (roi: Roi | null) => void
  onImageReady: (image: HTMLImageElement) => void
  onImageError: () => void
  maskUrl?: string
  actions?: ReactNode
}

type Gesture = {
  pointerId: number
  start: Point
} & (
  | { mode: 'draw' }
  | { mode: 'move'; original: Roi }
  | { mode: 'resize'; original: Roi; corner: Corner }
)

export function RoiEditor({ src, caseId, roi, onChange, onImageReady, onImageError, maskUrl, actions }: RoiEditorProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [size, setSize] = useState<ImageSize | null>(null)
  // undefined means no active gesture; null means a draft without area yet.
  const [draft, setDraft] = useState<Roi | null | undefined>(undefined)
  const svgRef = useRef<SVGSVGElement>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const instructionsId = useId()
  const visibleRoi = draft === undefined ? roi : draft

  function pointAt(event: PointerEvent<SVGElement>): Point | null {
    const svg = svgRef.current
    if (!svg || !size) return null
    return imagePoint(
      { x: event.clientX, y: event.clientY },
      svg.getBoundingClientRect(),
      size,
    )
  }

  function begin(event: PointerEvent<SVGElement>, mode: Gesture['mode'], corner?: Corner) {
    if (!event.isPrimary || event.button !== 0 || gestureRef.current) return
    const start = pointAt(event)
    const svg = svgRef.current
    if (!start || !svg) return
    event.preventDefault()
    event.stopPropagation()
    if (mode === 'move' && roi) {
      gestureRef.current = { pointerId: event.pointerId, start, mode, original: roi }
    } else if (mode === 'resize' && roi && corner) {
      gestureRef.current = { pointerId: event.pointerId, start, mode, original: roi, corner }
    } else {
      gestureRef.current = { pointerId: event.pointerId, start, mode: 'draw' }
    }
    setDraft(mode === 'draw' ? null : roi)
    svg.setPointerCapture(event.pointerId)
  }

  function candidate(event: PointerEvent<SVGElement>): Roi | null {
    const gesture = gestureRef.current
    const point = pointAt(event)
    if (!gesture || !point || !size) return null
    if (gesture.mode === 'draw') return createRoi(gesture.start, point, size)
    if (gesture.mode === 'resize') return resizeRoi(gesture.original, gesture.corner, point, size)
    return moveRoi(gesture.original, {
      x: point.x - gesture.start.x,
      y: point.y - gesture.start.y,
    }, size)
  }

  function cancel() {
    const gesture = gestureRef.current
    gestureRef.current = null
    setDraft(undefined)
    if (gesture && svgRef.current?.hasPointerCapture(gesture.pointerId)) {
      svgRef.current.releasePointerCapture(gesture.pointerId)
    }
  }

  function finish(event: PointerEvent<SVGSVGElement>) {
    if (gestureRef.current?.pointerId !== event.pointerId) return
    const next = candidate(event)
    cancel()
    // A click or a collapsed rectangle does not erase the previous selection.
    if (next) onChange(next)
  }

  const handles: { corner: Corner; x: number; y: number }[] = visibleRoi ? [
    { corner: 'nw', x: visibleRoi.x, y: visibleRoi.y },
    { corner: 'ne', x: visibleRoi.x + visibleRoi.width, y: visibleRoi.y },
    { corner: 'sw', x: visibleRoi.x, y: visibleRoi.y + visibleRoi.height },
    { corner: 'se', x: visibleRoi.x + visibleRoi.width, y: visibleRoi.y + visibleRoi.height },
  ] : []

  return (
    <Box gap="small">
      <Text id={instructionsId} size="small">
        {maskUrl
          ? 'Selecciona Imagen para volver a editar la ROI.'
          : 'Arrastra para dibujar una ROI; mueve su interior o ajusta sus esquinas. Dibuja fuera para reemplazarla.'}
      </Text>

      <Box background="black" round="small" pad="small" align="center" aria-busy={status === 'loading'}>
        {status === 'loading' && <Text role="status" color="white">Cargando imagen…</Text>}
        {status === 'error' && <Text role="alert" color="white">No se pudo cargar la imagen del caso {caseId}.</Text>}

        <div className="roi-stage" style={{ width: size?.width, display: status === 'error' ? 'none' : undefined }}>
          <img
            className="roi-image"
            src={src}
            alt={`Resonancia magnética del caso ${caseId}`}
            draggable={false}
            aria-hidden={!!maskUrl}
            style={{ visibility: maskUrl ? 'hidden' : undefined }}
            onLoad={(event) => {
              setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
              setStatus('ready')
              onImageReady(event.currentTarget)
            }}
            onError={() => { cancel(); setStatus('error'); onImageError() }}
          />
          {maskUrl && (
            <img className="roi-mask" src={maskUrl} alt={`Máscara del caso ${caseId}`} draggable={false} />
          )}
          {status === 'ready' && size && !maskUrl && (
            <svg
              ref={svgRef}
              className="roi-overlay"
              viewBox={`0 0 ${size.width} ${size.height}`}
              role="group"
              aria-label={`Selección de ROI del caso ${caseId}`}
              aria-describedby={instructionsId}
              onPointerDown={(event) => begin(event, 'draw')}
              onPointerMove={(event) => {
                if (gestureRef.current?.pointerId === event.pointerId) setDraft(candidate(event))
              }}
              onPointerUp={finish}
              onPointerCancel={cancel}
              onLostPointerCapture={cancel}
            >
              {visibleRoi && (
                <rect
                  className="roi-rectangle"
                  x={visibleRoi.x} y={visibleRoi.y}
                  width={visibleRoi.width} height={visibleRoi.height}
                  vectorEffect="non-scaling-stroke"
                  onPointerDown={(event) => begin(event, 'move')}
                />
              )}
              {handles.map(({ corner, x, y }) => (
                <rect
                  key={corner}
                  className={`roi-handle roi-handle-${corner}`}
                  data-corner={corner}
                  x={x - 7} y={y - 7} width={14} height={14}
                  vectorEffect="non-scaling-stroke"
                  onPointerDown={(event) => begin(event, 'resize', corner)}
                />
              ))}
            </svg>
          )}
        </div>
      </Box>

      <Box direction="row" gap="small" align="center" wrap>
        <Button label="Borrar ROI" disabled={!roi} onClick={() => { cancel(); onChange(null) }} />
        {actions}
      </Box>

      <Text size="small">{size ? `Imagen original: ${size.width} × ${size.height} píxeles.` : 'Dimensiones pendientes.'}</Text>
      <div className="roi-summary" role="status" aria-live="polite" aria-atomic="true">
        {visibleRoi
          ? `ROI: x=${visibleRoi.x}, y=${visibleRoi.y}, ancho=${visibleRoi.width}, alto=${visibleRoi.height} px`
          : 'Sin ROI seleccionada.'}
      </div>
      {visibleRoi && size && visibleRoi.width === size.width && visibleRoi.height === size.height && (
        <Text color="status-warning" size="small">La ROI ocupa toda la imagen. Deja algo de fondo fuera para inicializar GrabCut.</Text>
      )}
    </Box>
  )
}
