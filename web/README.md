# Laboratorio GrabCut · Web

Interfaz con React, TypeScript, Grommet y Vite para el proyecto Horus GrabCut.
La aplicación permite elegir entre los casos de `../data/images/`, con
`VS-SEG-018` como selección inicial si está disponible. El visor indica los
estados de carga y error y permite dibujar, mover y redimensionar una ROI.
La aplicación permite inicializar los modelos gaussianos y ejecutar GrabCut
paso a paso o en ejecuciones de varias iteraciones, con vecindad de ocho
píxeles y corte mínimo. Todo el
cálculo ocurre en el navegador; no necesita un servidor de procesamiento.

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
- `src/components/SegmentationWorkspace.tsx`: ROI, píxeles, inicialización y ciclo de vida del worker.
- `src/components/CaseSelector.tsx`: selector controlado de casos.
- `src/components/RoiEditor.tsx`: imagen, selección de ROI y estados de carga/error.
- `src/core/roi.ts`: coordenadas, límites, movimiento y ajuste de la ROI.
- `src/core/image.ts`: conversión RGBA a intensidades de 8 bits.
- `src/core/initialization.ts`: etiquetas iniciales y representación binaria.
- `src/core/gmm.ts`: mezclas gaussianas, asignación, reajuste y costos de apariencia.
- `src/core/spatial.ts`: vecindad, beta y penalizaciones en la frontera de la ROI.
- `src/core/mincut.ts`: grafo residual y flujo máximo de Dinic sin recursión.
- `src/core/grabcut.ts`: una iteración de reajuste y corte.
- `src/workers/segmentation.worker.ts`: inicialización e iteraciones fuera del hilo de la interfaz.
- `src/browser/imageData.ts`: lectura Canvas y vista previa de la máscara.
- `src/browser/segmentationJob.ts`: ejecución secuencial, cancelación y manejo de errores.
- `tests/segmentation-job.test.mjs`: límites, continuación y resultados tardíos de un worker cancelado.
- `tests/initialization.test.mjs`: intensidades, límites, etiquetas y conteos.
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

## Inicialización

Después de dibujar una ROI, pulsa **Inicializar**. La vista cambia a una máscara
con blanco dentro de la ROI (región candidata) y negro fuera (fondo seguro).
Los controles **Imagen** y **Máscara inicial** permiten alternar entre ambas.
Se muestran los conteos de píxeles de las dos clases. Esta máscara todavía no
es la segmentación de GrabCut.

Canvas lee la imagen a su resolución original. Las imágenes actuales son PNG
en escala de grises de 8 bits: sus intensidades se conservan exactamente.
La conversión RGB usa luminancia redondeada; se rechazan imágenes transparentes.
Los píxeles y etiquetas se almacenan en `Uint8Array`, con índice `y * width + x`.
Las etiquetas son 0/1; se convierten a 0/255 solo para la vista previa.

Cambiar o borrar la ROI descarta la inicialización y vuelve a la imagen.
Cambiar de caso reinicia todo el estado mediante un componente con `key`.
La ROI debe dejar al menos un píxel de fondo fuera: una selección que cubra
toda la imagen no permite inicializar. Las anotaciones no intervienen.

## Modelos gaussianos y K

El selector **Gaussianas por clase (K)** permite elegir entre 1 y 10 componentes,
con 5 como valor inicial. K se conserva al cambiar de imagen. Cambiar K descarta
la inicialización y los modelos anteriores, conserva la ROI y requiere pulsar
**Inicializar** otra vez. Cada clase debe contener al menos K píxeles; no se
reduce K silenciosamente cuando una selección es demasiado pequeña.

**Inicializar** prepara la máscara y, en un Web Worker, los GMM de fondo y región
candidata. La interfaz confirma cuando los modelos están preparados. Las
anotaciones de referencia no participan. La máscara permanece rectangular hasta
pulsar **Ejecutar una iteración**.

El portado reproduce `grabcut2.ipynb`: grupos de intensidades ordenadas con la
misma distribución de tamaños que `np.array_split`, varianza poblacional más
`1e-6`, asignación dura ponderada, una actualización y costo marginal mediante
log-sum-exp estable. Se conservan los parámetros de componentes vacíos con peso
cero; una clase vacía durante un reajuste conserva una copia del modelo anterior.
Los empates de asignación favorecen al primer componente, como `argmin` de NumPy.
Los costos pueden ser negativos y no se truncan.

Las intensidades son de 8 bits: los costos se calculan para las 256 intensidades
y se asignan después a cada píxel. Se usan `Float64Array` para los parámetros y
costos. Los datos de entrada se clonan al enviar al worker y los resultados
se devuelven como arreglos transferibles; los datos de la interfaz permanecen
disponibles para reintentar si falla un cálculo. Cambiar ROI, K o caso cancela el trabajo anterior,
y los mensajes obsoletos no pueden reemplazar los resultados actuales.

## Referencias numéricas de Python

`npm test` incluye referencias de tres imágenes del repositorio para K = 1, 3,
5 y 8. Compara pesos, medias, varianzas, asignaciones y costos en las 256
intensidades. Las asignaciones deben coincidir exactamente; los valores de punto
flotante usan tolerancia absoluta `1e-8` más relativa `1e-10`.

Los resultados están en `tests/fixtures/gmm-python.json`, junto con hashes de
las imágenes y del cuaderno utilizado. Los histogramas conservan las muestras
sin duplicar los PNG. Las pruebas habituales no necesitan Python ni OpenCV.
Para regenerar las referencias desde `web/`, con el entorno Python del
repositorio ya preparado:

```bash
../.venv/bin/python scripts/generate-gmm-fixtures.py
npm test
```

El generador extrae únicamente las cuatro funciones numéricas del cuaderno;
no ejecuta sus celdas de interfaz ni modifica imágenes, anotaciones o notebooks.

## Una iteración de GrabCut

Tras inicializar, pulsa **Ejecutar una iteración**. La vista **Segmentación**
muestra el objeto en blanco y el fondo en negro, junto con el número de
iteración, los píxeles que cambiaron y el tamaño del objeto. Puedes repetir el
botón para avanzar manualmente. **Imagen** permite volver al original y editar
la ROI; modificarla, borrarla o cambiar K descarta todas las iteraciones.
Cambiar de caso también cancela el worker y reinicia el resultado.

La primera iteración utiliza los costos preparados por **Inicializar**, sin
repetir la primera asignación y actualización de GMM. Las siguientes reasignan
componentes y reajustan los modelos con la última máscara antes de cortar.
Una clase vacía conserva su modelo anterior, igual que el cuaderno. La interfaz
avisa cuando no queda objeto o cuando una iteración no cambia la máscara;
esto último no se presenta como una garantía de convergencia de los modelos.

El término espacial reproduce `grabcut2.ipynb`: ocho vecinos, cada par una sola
vez, distancias 1 y √2, beta calculado sobre los pares de **toda la imagen** y
pesos `gamma * exp(-beta * diferencia²) / distancia`. Gamma queda fijo en 10,
el valor que selecciona el cuaderno tras su comparación. Una imagen uniforme
usa beta = 0. No se utilizan las anotaciones de referencia.

Solo los píxeles dentro de la ROI son nodos variables. Los vecinos externos
permanecen como fondo: sus enlaces suman una penalización al costo de objeto
del nodo interior. El corte usa Dinic con arreglos tipados y pila explícita,
sin recursión. Se resta el mínimo de cada par de costos para obtener capacidades
no negativas, conservando esa constante al calcular la energía del resultado.
La tolerancia residual es `1e-10`, como en Python. El lado de la fuente es objeto.

Los diagnósticos numéricos comparan energía antes y después del corte con los
**mismos modelos**, y omiten el término constante de apariencia exterior, como
el cuaderno. No debe interpretarse una comparación entre iteraciones como si
los modelos fueran fijos. La UI mantiene únicamente máscara y conteos; la
energía y beta quedan disponibles en el resultado del núcleo para las pruebas.

Las pruebas comprueban orientación de terminales, costos negativos, empates,
vecindad, fronteras, imágenes uniformes y clases vacías. Enumeran todas las
etiquetas de 120 grafos pequeños para verificar el óptimo global y prueban una
cadena de 20.000 nodos para detectar dependencias de la pila de llamadas.
`tests/fixtures/grabcut-python.json` contiene tres iteraciones de los casos
001, 017 y 018 con K = 5, además de K = 1 y 8 en el caso 017. Las máscaras deben
coincidir píxel a píxel y las energías usan tolerancia absoluta `1e-7` más
relativa `1e-9`. Los PNG originales se leen en las pruebas y sus intensidades
se verifican mediante hashes generados con OpenCV, sin duplicar las imágenes.

Para regenerar las referencias del corte:

```bash
../.venv/bin/python scripts/generate-grabcut-fixtures.py
npm test
```

El generador extrae las funciones numéricas y los bloques espaciales del
cuaderno sin ejecutar su interfaz. Las pruebas habituales solo necesitan Node.
No se han añadido dependencias. La superposición sobre la imagen original,
la evaluación contra anotaciones y la exportación quedan para pasos posteriores.

## Ejecución automática y detención

**Máximo de iteraciones** permite elegir entre 1 y 20, con 5 por defecto.
El límite se aplica a cada pulsación de **Ejecutar**: se calculan esa cantidad
de iteraciones nuevas desde la máscara actual. Por ejemplo, si has completado
2 iteraciones manuales y ejecutas otras 5, el resultado final será la iteración
7. El progreso **Iteración 3 de 5** corresponde a la ejecución en curso; el
contador junto al tamaño del objeto acumula todas las iteraciones completadas.

Cada resultado actualiza la máscara y los conteos antes de pedir el siguiente
corte. La ejecución termina al alcanzar el límite; no se detiene automáticamente
por una máscara sin cambios, porque los modelos aún pueden seguir ajustándose.
**Ejecutar una iteración** sigue disponible para avanzar manualmente.

Durante un cálculo aparece **Detener** y se deshabilitan los botones de nueva
ejecución y el selector del límite. Detener termina el worker, descarta el corte
en curso y conserva la última máscara y los modelos aceptados. Si todavía no
terminó ningún corte, conserva el estado anterior, incluida la máscara inicial.
Después puedes continuar manualmente o iniciar otra ejecución automática.
Un fallo también conserva el último resultado para poder reintentar.

Cambiar el máximo conserva la segmentación y solo afecta a la próxima ejecución.
El máximo seleccionado se conserva al cambiar de caso, igual que K. Cambiar K,
modificar/borrar la ROI o cambiar de caso cancela la ejecución y descarta la
segmentación anterior. Los mensajes tardíos de un worker cancelado se ignoran.

El controlador reutiliza un worker por ejecución y envía una solicitud a la vez.
El resultado aceptado aporta las etiquetas, modelos y número acumulado para la
siguiente solicitud; no se reinicializan los GMM entre pasos. Las pruebas cubren
el límite exacto, la continuidad de datos, la ausencia de parada prematura,
la cancelación antes/después del primer resultado y los errores de envío,
cálculo, recepción o presentación, sin añadir dependencias de pruebas.
