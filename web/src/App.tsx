import { Box, Grommet, Heading, Paragraph, Text } from 'grommet'
import type { ThemeType } from 'grommet'

const theme: ThemeType = {
  global: {
    colors: {
      brand: '#2563eb',
      background: '#f8fafc',
      text: '#0f172a',
    },
    font: {
      family: 'system-ui, sans-serif',
      size: '16px',
      height: '24px',
    },
  },
}

const caseId = 'VS-SEG-018'
const imageUrl = `${import.meta.env.BASE_URL}images/${caseId}.png`

export default function App() {
  return (
    <Grommet theme={theme} full>
      <Box
        as="main"
        background="background"
        height={{ min: '100vh' }}
        pad="medium"
      >
        <Box
          width={{ max: '1100px' }}
          alignSelf="center"
          fill="horizontal"
          gap="medium"
        >
          <Box as="header" gap="small">
            <Heading level={1} margin="none">
              Laboratorio GrabCut
            </Heading>

            <Paragraph margin="none" fill>
              Explora la segmentación de imágenes paso a paso.
            </Paragraph>
          </Box>

          <Box
            as="section"
            background="white"
            round="small"
            border
            pad="medium"
            gap="medium"
          >
            <Heading level={2} margin="none">
              Caso {caseId}
            </Heading>

            <Text>Imagen original del repositorio</Text>

            <Box
              background="black"
              round="small"
              overflow="hidden"
              align="center"
              pad="small"
            >
              <img
                src={imageUrl}
                alt={`Resonancia magnética del caso ${caseId}`}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  height: 'auto',
                }}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Grommet>
  )
}
