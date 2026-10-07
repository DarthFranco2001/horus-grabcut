# Laboratorio GrabCut · Web

Interfaz con React, TypeScript, Grommet y Vite para el proyecto Horus GrabCut.
La base actual muestra el caso `VS-SEG-018` de `../data/images/`.
El selector de casos, la ROI y el motor de segmentación todavía no están implementados.

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

## Archivos principales

- `src/main.tsx`: monta React y mantiene `StrictMode` para desarrollo.
- `src/App.tsx`: pantalla inicial y tema de Grommet.
- `src/index.css`: estilos globales mínimos.
- `index.html`: documento de entrada, idioma y metadatos.
- `vite.config.ts`: integración de React, ruta base y archivos públicos.
- `tsconfig*.json`: configuración de TypeScript.
- `eslint.config.js`: reglas de revisión del código.
