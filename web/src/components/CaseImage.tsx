import { useState } from 'react'
import { Box, Text } from 'grommet'

interface CaseImageProps {
  src: string
  caseId: string
}

type ImageStatus = 'loading' | 'ready' | 'error'

export function CaseImage({ src, caseId }: CaseImageProps) {
  const [status, setStatus] = useState<ImageStatus>('loading')

  return (
    <Box
      background="black"
      round="small"
      overflow="hidden"
      align="center"
      pad="small"
      gap="small"
      aria-busy={status === 'loading'}
    >
      {status === 'loading' && (
        <Text role="status" color="white">
          Cargando imagen…
        </Text>
      )}

      {status === 'error' && (
        <Text role="alert" color="white">
          No se pudo cargar la imagen del caso {caseId}.
        </Text>
      )}

      <img
        src={src}
        alt={`Resonancia magnética del caso ${caseId}`}
        onLoad={() => setStatus('ready')}
        onError={() => setStatus('error')}
        style={{
          display: status === 'error' ? 'none' : 'block',
          maxWidth: '100%',
          height: 'auto',
        }}
      />
    </Box>
  )
}
