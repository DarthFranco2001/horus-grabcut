import { useEffect, useRef, useState } from 'react'
import { Box, Select, Text } from 'grommet'
import { RoiEditor } from './RoiEditor'
import { ReferenceMetrics } from './ReferenceComparison'
import { useGroundTruth } from '../hooks/useGroundTruth'
import { readGrayscaleImage, createMaskPreview, createCutoutPreview } from '../browser/imageData'
import type { GrayscaleImage } from '../core/image'
import type { Roi } from '../core/roi'
import type { IterationResult } from '../core/grabcut'
import { MAX_ITERATIONS } from '../browser/segmentationJob'
import { startGrabCutJob } from '../browser/grabcutJob'
import './SegmentationWorkspace.css'

interface SegmentationWorkspaceProps {
  src: string
  caseId: string
  annotationUrl: string | null
  components: number
  onComponentsChange: (k: number) => void
  iterations: number
  onIterationsChange: (iterations: number) => void
}

interface RunProgress {
  completed: number
  total: number
  status: 'running' | 'stopped' | 'complete' | 'failed'
}

const iterationOptions = Array.from({ length: MAX_ITERATIONS }, (_, i) => i + 1)
const componentOptions = Array.from({ length: 10 }, (_, i) => i + 1)

export function SegmentationWorkspace({ src, caseId, annotationUrl, components, onComponentsChange, iterations, onIterationsChange }: SegmentationWorkspaceProps) {
  const [roi, setRoi] = useState<Roi | null>(null)
  const [image, setImage] = useState<GrayscaleImage | null>(null)
  const [view, setView] = useState<'image' | 'mask' | 'cutout'>('image')
  const [error, setError] = useState<string | null>(null)
  const [segmentation, setSegmentation] = useState<(IterationResult & { previewUrl: string; cutoutUrl: string }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<RunProgress | null>(null)
  const { state: reference, retry: retryReference } = useGroundTruth(annotationUrl, image)
  const jobRef = useRef<ReturnType<typeof startGrabCutJob> | null>(null)

  useEffect(() => () => {
    jobRef.current?.stop()
    jobRef.current = null
  }, [])

  function stopJob() {
    jobRef.current?.stop()
    jobRef.current = null
    setBusy(false)
  }

  function resetCalculation() {
    stopJob()
    setSegmentation(null)
    setProgress(null)
  }

  function changeComponents(k: number) {
    if (k === components) return
    resetCalculation()
    onComponentsChange(k)
    setView('image')
    setError(null)
  }

  function changeRoi(next: Roi | null) {
    if (roi?.x === next?.x && roi?.y === next?.y
      && roi?.width === next?.width && roi?.height === next?.height) return
    resetCalculation()
    setRoi(next)
    setView('image')
    setError(null)
  }

  function imageReady(element: HTMLImageElement) {
    resetCalculation()
    setView('image')
    setError(null)
    try {
      setImage(readGrayscaleImage(element))
    } catch (cause) {
      setImage(null)
      setError(cause instanceof Error ? cause.message : 'No se pudieron leer los píxeles.')
    }
  }

  function imageFailed() {
    resetCalculation()
    setImage(null)
    setRoi(null)
    setView('image')
    setError(null)
  }

  function stopExecution() {
    stopJob()
    setProgress((previous) => previous ? { ...previous, status: 'stopped' } : null)
  }

  function restart() {
    resetCalculation()
    setView('image')
    setError(null)
  }

  function segment() {
    if (!image || !roi || busy) return
    restart()
    setBusy(true)
    setProgress({ completed: 0, total: iterations, status: 'running' })
    try {
      jobRef.current = startGrabCutJob(
        () => new Worker(new URL('../workers/segmentation.worker.ts', import.meta.url), { type: 'module' }),
        { image, roi, k: components, iterations },
        {
          onResult(result, completed) {
            const previewUrl = createMaskPreview({ ...image, labels: result.labels })
            const cutoutUrl = createCutoutPreview(image, result.labels)
            setSegmentation({ ...result, previewUrl, cutoutUrl })
            setProgress({ completed, total: iterations, status: 'running' })
            if (completed === 1) setView('cutout')
          },
          onComplete() {
            jobRef.current = null
            setBusy(false)
            setProgress((previous) => previous ? { ...previous, status: 'complete' } : null)
          },
          onError(message) {
            jobRef.current = null
            setBusy(false)
            setProgress((previous) => previous ? { ...previous, status: 'failed' } : null)
            setError(message)
          },
        },
      )
    } catch (cause) {
      stopJob()
      setProgress(null)
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar la segmentación.')
    }
  }

  const availableReference = reference.status === 'ready' ? reference.data : null
  const coversImage = !!(image && roi && roi.width === image.width && roi.height === image.height)

  return (
    <Box gap="small">
      <Box direction="row" wrap style={{ gap: '12px 24px' }}>
        <Box direction="row" align="center" gap="small" flex={false}>
          <label htmlFor="gmm-components">Gaussianas (K)</label>
          <Box width="xsmall">
            <Select
              id="gmm-components"
              options={componentOptions}
              value={components}
              disabled={busy || segmentation !== null}
              onChange={({ option }: { option: unknown }) => {
                if (typeof option === 'number' && componentOptions.includes(option)) changeComponents(option)
              }}
            />
          </Box>
        </Box>
        <Box direction="row" align="center" gap="small" flex={false}>
          <label htmlFor="run-iterations">Iteraciones</label>
          <Box width="xsmall">
            <Select
              id="run-iterations"
              options={iterationOptions}
              value={iterations}
              disabled={busy || segmentation !== null}
              onChange={({ option }: { option: unknown }) => {
                if (typeof option === 'number' && iterationOptions.includes(option)) onIterationsChange(option)
              }}
            />
          </Box>
        </Box>
      </Box>
      <RoiEditor
        src={src}
        caseId={caseId}
        roi={roi}
        onChange={changeRoi}
        onImageReady={imageReady}
        onImageError={imageFailed}
        readOnly={busy || segmentation !== null}
        preview={view === 'cutout' && segmentation
          ? { src: segmentation.cutoutUrl, kind: 'cutout' }
          : view === 'mask' && segmentation
            ? { src: segmentation.previewUrl, kind: 'mask' }
            : undefined}
        actions={(
          <div className="workspace-toolbar" role="group" aria-label={busy ? 'Segmentación en curso' : segmentation ? 'Visualización' : 'Preparación'}>
            {busy ? (
              <button className="action-button" type="button" onClick={stopExecution}>Detener</button>
            ) : segmentation ? (
              <>
                <button className="action-button" type="button" onClick={restart}>Reiniciar</button>
                {([
                  { value: 'image', label: 'Imagen' },
                  { value: 'mask', label: 'Máscara' },
                  { value: 'cutout', label: 'Recorte' },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    className="action-button"
                    type="button"
                    aria-pressed={view === value}
                    onClick={() => setView(value)}
                  >
                    {label}
                  </button>
                ))}
              </>
            ) : (
              <>
                <button className="action-button" type="button" disabled={!roi} onClick={() => changeRoi(null)}>Borrar ROI</button>
                <button className="action-button" type="button" disabled={!image || !roi || coversImage} onClick={segment}>Segmentar</button>
              </>
            )}
          </div>
        )}
      />
      {reference.status === 'loading' && <Text role="status" size="small">Cargando referencia…</Text>}
      {reference.status === 'absent' && <Text size="small">Este caso no tiene referencia. Puedes usar GrabCut sin comparación.</Text>}
      {reference.status === 'error' && (
        <Box gap="small" align="start">
          <Text role="alert" size="small">{reference.message} Puedes seguir usando GrabCut.</Text>
          <button className="action-button" type="button" onClick={retryReference}>Reintentar referencia</button>
        </Box>
      )}
      {progress && progress.status !== 'complete' && (
        <Text role="status" size="small">
          {progress.status === 'running' && `Iteración ${Math.min(progress.completed + 1, progress.total)} de ${progress.total}…`}
          {progress.status === 'stopped' && `Ejecución detenida: ${progress.completed} de ${progress.total} ${progress.total === 1 ? 'iteración completada' : 'iteraciones completadas'}. ${progress.completed > 0 ? 'Se conserva la última máscara terminada.' : ''}`}
          {progress.status === 'failed' && `Ejecución interrumpida: ${progress.completed} de ${progress.total} ${progress.total === 1 ? 'iteración completada' : 'iteraciones completadas'}. ${progress.completed > 0 ? 'Se conserva la última máscara terminada.' : ''}`}
        </Text>
      )}
      {error && <Text role="alert" color="status-critical">{error}</Text>}
      {segmentation?.foregroundCount === 0 && (
        <Text size="small">No quedó objeto. Pulsa Reiniciar y ajusta la ROI o K.</Text>
      )}
      {availableReference && annotationUrl && segmentation && roi && (
        <ReferenceMetrics
          reference={availableReference}
          prediction={segmentation.labels}
          roi={roi}
          annotationUrl={annotationUrl}
          caseId={caseId}
        />
      )}
    </Box>
  )
}
