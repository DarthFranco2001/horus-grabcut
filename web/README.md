# Laboratorio GrabCut · Web

Interfaz con React, TypeScript, Grommet y Vite para el proyecto Horus GrabCut.
La aplicación permite elegir entre los casos de `../data/images/`, con
`VS-SEG-018` como selección inicial si está disponible. El visor indica los
estados de carga y error y permite dibujar, mover y redimensionar una ROI.
El motor de segmentación todavía no está implementado.

## Desarrollo local

Desde esta carpeta (`web/`):

```bash
nvm use
npm ci
npm run dev
```

La versión de Node está declarada en `.nvmrc`. Si `nvm` no está disponible
en la terminal, carga su instalación existente con `source "$HOME/.nvm/nvm.sh"`.

Abre la dirección que indique Vite, normalmente
`http://localhost:5173/horus-grabcut/`.

Las dependencias se instalan en `web/node_modules/`; no se requieren paquetes
npm globales. `package-lock.json` fija las versiones para `npm ci`.

## Comprobaciones

```bash
npm run lint
npm test
npm run build
npm run preview
```

`lint` comprueba el código con ESLint. `build` verifica los tipos en modo
estricto y genera `dist/`. `preview` sirve esa compilación localmente;
no publica la aplicación. Ni `node_modules/` ni `dist/` se versionan.

## Imágenes y publicación

`vite.config.ts` declara `publicDir: '../data'`. Vite sirve directamente los
archivos de esa carpeta durante el desarrollo y copia su contenido a `dist/`
al compilar. Incluye tanto las imágenes como las anotaciones; no hace falta
copiarlas manualmente a `web/`.

Las direcciones se construyen con `import.meta.env.BASE_URL`, por ejemplo:

```ts
const imageUrl = `${import.meta.env.BASE_URL}images/VS-SEG-018.png`
```

La base `/horus-grabcut/` está preparada para la ruta del repositorio en
GitHub Pages. El flujo de despliegue todavía no está configurado.

## Catálogo de casos

`npm run catalog` genera `src/generated/cases.json` a partir de los archivos
`VS-SEG-XXX.png` de `../data/images/`. Cada entrada incluye su identificador,
la ruta de la imagen y la ruta de su anotación en `../data/contours/`, o `null`
si no existe. Las anotaciones no se usan para segmentar ni se cargan en el visor.

Los comandos `dev`, `build` y `lint` generan el catálogo automáticamente
mediante sus respectivos scripts `pre`. El JSON generado está ignorado por Git;
no se edita manualmente. Al añadir imágenes con el servidor ya iniciado,
ejecuta `npm run catalog` o reinicia `npm run dev`.

## Archivos principales

- `src/main.tsx`: monta React y mantiene `StrictMode` para desarrollo.
- `src/App.tsx`: caso seleccionado, composición de la pantalla y tema.
- `src/components/CaseSelector.tsx`: selector controlado de casos.
- `src/components/RoiEditor.tsx`: imagen, selección de ROI y estados de carga/error.
- `src/core/roi.ts`: coordenadas, límites, movimiento y ajuste de la ROI.
- `tests/roi.test.mjs`: pruebas de geometría con el runner integrado de Node.
- `src/data/cases.ts`: tipos e importación del catálogo.
- `scripts/generate-catalog.mjs`: generación del catálogo con Node.
- `src/index.css`: estilos globales mínimos.
- `index.html`: documento de entrada, idioma y metadatos.
- `vite.config.ts`: integración de React, ruta base y archivos públicos.
- `tsconfig*.json`: configuración de TypeScript.
- `eslint.config.js`: reglas de revisión del código.

## Selección de ROI

Arrastra en cualquier dirección sobre la imagen para dibujar una ROI. Mueve el
rectángulo desde su interior y ajusta su tamaño desde las cuatro esquinas.
Las coordenadas se expresan en píxeles originales y se mantienen al cambiar el
tamaño del visor. Los bordes derecho e inferior son exclusivos, como en NumPy.

La interacción de la ROI se realiza sobre la imagen con el mouse; el único
botón del editor es «Borrar ROI». La cancelación del puntero descarta el
arrastre en curso y conserva la selección anterior. Un clic sin área tampoco
elimina la selección existente.

Cambiar de caso limpia la ROI. La selección permanece solo en memoria, sin
modificar imágenes ni anotaciones del repositorio. Una ROI que ocupe toda la
imagen muestra un aviso porque GrabCut necesitará muestras de fondo externas.
