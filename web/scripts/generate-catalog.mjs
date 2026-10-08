import { mkdir, readdir, writeFile } from 'node:fs/promises'

const imagesDirectory = new URL('../../data/images/', import.meta.url)
const annotationsDirectory = new URL('../../data/contours/', import.meta.url)
const outputDirectory = new URL('../src/generated/', import.meta.url)
const outputFile = new URL('cases.json', outputDirectory)

const [imageEntries, annotationEntries] = await Promise.all([
  readdir(imagesDirectory, { withFileTypes: true }),
  readdir(annotationsDirectory, { withFileTypes: true }),
])

const annotationNames = new Set(
  annotationEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name),
)

const imageNames = imageEntries
  .filter((entry) => entry.isFile() && /^VS-SEG-\d{3}\.png$/.test(entry.name))
  .map((entry) => entry.name)
  .sort()

if (imageNames.length === 0) {
  throw new Error('No se encontraron imágenes VS-SEG-XXX.png en data/images/.')
}

const cases = imageNames.map((filename) => ({
  id: filename.replace(/\.png$/, ''),
  imagePath: `images/${filename}`,
  annotationPath: annotationNames.has(filename)
    ? `contours/${filename}`
    : null,
}))

await mkdir(outputDirectory, { recursive: true })
await writeFile(outputFile, `${JSON.stringify(cases, null, 2)}\n`, 'utf8')

const annotatedCount = cases.filter(
  (imageCase) => imageCase.annotationPath !== null,
).length

console.log(
  `Catálogo generado: ${cases.length} casos, ${annotatedCount} con anotación.`,
)
