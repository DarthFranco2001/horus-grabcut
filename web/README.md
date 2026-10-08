# Laboratorio GrabCut · Web

Interfaz con React, TypeScript, Grommet y Vite para el proyecto Horus GrabCut.
La aplicación permite elegir entre los casos de `../data/images/`, con
`VS-SEG-001` como selección inicial si está disponible. El visor indica los
estados de carga y error y permite dibujar, mover y redimensionar una ROI.
Una sola acción prepara los modelos gaussianos y ejecuta las iteraciones de
GrabCut seleccionadas, con vecindad de ocho píxeles y corte mínimo. Todo el
cálculo ocurre en el navegador; no necesita un servidor de procesamiento.
Las anotaciones del repositorio permiten visualizar la referencia y evaluar
la segmentación de cada caso.

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
si no existe. Las anotaciones se cargan para visualizar y evaluar la referencia;
no se usan como entrada del algoritmo de segmentación.

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
- `src/browser/grabcutJob.ts`: encadena inicialización y cortes en una sola acción.
- `src/components/SegmentationWorkspace.css`: botonera adaptable y estados seleccionados.
- `src/core/evaluation.ts`: extracción de referencia y métricas de máscaras.
- `src/browser/groundTruth.ts`: carga y lectura de anotaciones a resolución nativa.
- `src/hooks/useGroundTruth.ts`: estados de carga, cancelación y reintento por caso.
- `src/components/ReferenceComparison.tsx`: métricas de evaluación con la referencia.
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
Las coordenadas se almacenan internamente en píxeles originales y se mantienen
al cambiar el tamaño del visor. Los bordes derecho e inferior son exclusivos,
como en NumPy. La interfaz no muestra dimensiones ni coordenadas numéricas.

La interacción de la ROI se realiza sobre la imagen con el mouse; el único
botón del editor es «Borrar ROI». La cancelación del puntero descarta el
arrastre en curso y conserva la selección anterior. Un clic sin área tampoco
elimina la selección existente.

Cambiar de caso limpia la ROI. La selección permanece solo en memoria, sin
modificar imágenes ni anotaciones del repositorio. Una ROI que ocupe toda la
imagen muestra un aviso porque GrabCut necesitará muestras de fondo externas.

## Inicialización

Después de dibujar una ROI, pulsa **Segmentar**. Esta única acción prepara las
etiquetas iniciales y los modelos, y ejecuta las iteraciones seleccionadas.
La máscara rectangular inicial es interna; no hay un paso intermedio de ejecución.

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

El selector **Gaussianas (K)** permite elegir entre 1 y 10 componentes,
con 5 como valor inicial. K se conserva al cambiar de imagen. K e Iteraciones
se pueden editar durante la preparación; se deshabilitan al calcular y mostrar
resultados. **Reiniciar** vuelve a habilitarlos y conserva la ROI. Cada clase
debe contener al menos K píxeles; no se reduce K silenciosamente cuando una
selección es demasiado pequeña.

**Segmentar** prepara la máscara y, en un Web Worker, los GMM de fondo y región
candidata. Después inicia automáticamente los cortes. Las anotaciones de
referencia no participan.

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

**Segmentar** calcula la cantidad de iteraciones seleccionada. Al terminar,
**Imagen**, **Máscara** y **Recorte** permiten cambiar la visualización.
**Reiniciar** descarta el resultado y permite volver a editar la ROI y parámetros.
Cambiar de caso también cancela el worker y reinicia el resultado.

La primera iteración utiliza los costos preparados en la inicialización, sin
repetir la primera asignación y actualización de GMM. Las siguientes reasignan
componentes y reajustan los modelos con la última máscara antes de cortar.
Una clase vacía conserva su modelo anterior, igual que el cuaderno. La interfaz
avisa cuando no queda objeto para que puedas ajustar la ROI o K.

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
No se han añadido dependencias. La exportación queda para un paso posterior.

## Flujo y detención

La botonera usa el mismo turquesa de la ROI (`#22d3ee`), con fondo blanco y
contorno turquesa. La vista seleccionada tiene fondo turquesa sólido y estado
accesible `aria-pressed`. Los botones se centran y reparten en filas según el ancho.

- Preparación: **Borrar ROI** y **Segmentar**.
- Cálculo: **Detener** y el progreso; los parámetros quedan bloqueados.
- Visualización: **Reiniciar**, **Imagen**, **Máscara** y **Recorte**.

**Iteraciones** permite elegir entre 1 y 20, con 5 por defecto. **Segmentar**
siempre inicia desde la ROI y ejecuta exactamente esa cantidad de cortes.
Cada resultado actualiza la imagen antes de pedir el siguiente corte. No se
para automáticamente por una máscara sin cambios: los modelos pueden seguir
ajustándose. El progreso desaparece al completarse.

**Detener** cancela el cálculo en curso y conserva el último resultado terminado.
Si no terminó ningún corte, vuelve a preparación; si hay resultado, permite
visualizarlo o reiniciar. Un fallo conserva igualmente los resultados aceptados.
**Reiniciar** descarta la segmentación y métricas, conserva ROI y parámetros y
vuelve a preparación. Cambiar de caso cancela todo y limpia la ROI. Los mensajes
tardíos de un worker cancelado se ignoran.

El controlador termina el worker de inicialización antes de crear el de cortes.
El segundo worker se reutiliza para todos los cortes y recibe una solicitud a
la vez, con los modelos y etiquetas del resultado anterior. Las pruebas cubren
el encadenamiento automático, número exacto de cortes, cancelación en ambas
fases, errores de creación/cálculo y descarte de respuestas tardías.

## Referencia y comparación

Las imágenes de `data/contours/` contienen la anotación roja sobre la imagen
original. Al seleccionar un caso, la aplicación carga su anotación, verifica
que tenga las mismas dimensiones y extrae la referencia con `R > G && R > B`.
No usa un umbral sobre la MRI, no rellena huecos ni recorta la referencia a la
ROI. Los archivos del repositorio permanecen intactos. La referencia no se
transfiere al worker de GrabCut ni altera sus modelos, etiquetas o parámetros.

El visor ofrece las vistas disponibles según el estado:

- **Imagen**: imagen original. Para editar la ROI, pulsa **Reiniciar**.
- **Máscara**: etiquetas actuales en blanco y negro.
- **Recorte**: intensidades originales del objeto sobre fondo negro. Los píxeles
  excluidos permanecen transparentes en la vista previa generada. Conserva las dimensiones y posición originales; no
  modifica la segmentación ni las métricas. Aparece tras el primer resultado y
  se selecciona automáticamente al obtener el primer resultado.

La ROI se edita durante la preparación, después de **Reiniciar**. La referencia se utiliza para calcular las
métricas; no hay una vista de contornos superpuestos.

Tras la primera iteración aparece **Evaluación · referencia médica**, con las
mismas métricas de la sección 13.1 de `notebooks/grabcut2.ipynb`:

- **Falsos positivos (FP)**: píxeles marcados como objeto por GrabCut, pero no por la referencia.
- **Falsos negativos (FN)**: píxeles de referencia que GrabCut deja como fondo.
- **MSE global**: `(FP + FN) / N`, con N igual al total de píxeles de la imagen.
- **MSE en la ROI**: errores dentro de la ROI divididos por el área de la ROI.

La evaluación muestra las métricas a la izquierda y la imagen de anotación
médica original del repositorio a la derecha, con la altura del bloque de
métricas y sin deformar sus proporciones. Las etiquetas están en negrita y los
valores en texto normal. En espacios estrechos, la imagen pasa debajo de las
métricas como miniatura de 160 píxeles de alto. Las cuatro cifras se muestran directamente. FP, FN y MSE global usan la
**imagen completa**, sin recortar la referencia. El MSE opera sobre etiquetas
0/1: contar desacuerdos equivale exactamente a promediar las diferencias al
cuadrado. Se muestra con seis decimales, como en el cuaderno. Las dos máscaras
vacías tienen FP = FN = MSE = 0, sin convenciones adicionales. Los píxeles de referencia fuera de ROI se muestran como contexto cuando los hay.
No se evalúa la máscara rectangular inicial como si fuera el resultado.

Cambiar o borrar la ROI o cambiar K elimina la evaluación anterior, pero
conserva la referencia cargada. Cambiar de caso cancela la carga anterior;
sus respuestas tardías se ignoran. Detener la ejecución conserva las métricas
de la última máscara terminada. Una anotación ausente, inaccesible o con tamaño
incompatible no impide usar GrabCut. Los errores de carga ofrecen **Reintentar
referencia**, sin reiniciar la segmentación. No se redimensionan referencias
incompatibles para forzar una comparación.

`tests/fixtures/evaluation-python.json` verifica las 30 anotaciones, incluidos
hashes de RGBA y etiquetas extraídas, y las métricas de 15 máscaras obtenidas
del cuaderno. Los casos sintéticos cubren coincidencia, disjunción, máscaras
vacías, errores fuera de ROI, selecciones ajenas al objeto y entradas inválidas. Las pruebas
de carga comprueban errores de red/decodificación, tamaños incompatibles,
cancelación y liberación del bitmap. Todo se prueba con Node sin dependencias
nuevas; Python solo se usa para regenerar las referencias:

```bash
../.venv/bin/python scripts/generate-evaluation-fixtures.py
npm test
```

## Auditoría de correspondencia con el cuaderno

La referencia de implementación es `notebooks/grabcut2.ipynb`. La evaluación
usa únicamente FP, FN y MSE global/ROI, como su sección 13.1. La extracción
roja, las etiquetas 0/1 y la inclusión de referencia fuera de ROI coinciden con
la sección 12; las pruebas contrastan las 30 anotaciones y 15 resultados.

Las diferencias que permanecen son de alcance o interacción:

| Aspecto | Cuaderno | Web |
| --- | --- | --- |
| Modelos y corte | Variante didáctica en grises, Dinic recursivo | Misma variante; Dinic con pila explícita y worker. Tres iteraciones contrastadas píxel a píxel en las referencias de prueba. |
| Parámetros | K = 5, cinco iteraciones en el ejemplo; explora gamma y selecciona 10 | K de 1 a 10, ejecución de 1 a 20 pasos; defaults 5 y gamma fijo en 10. |
| ROI | Convierte coordenadas con `int`, truncando | Redondea a píxeles y limita al borde; igual ROI entera produce el mismo cálculo. |
| Acceso a referencia | Se muestra al final, después de segmentar | Se utiliza para las métricas después de la primera iteración; sigue fuera de los datos enviados al algoritmo. |
| Contornos | Matplotlib interpola el nivel 0,5 y amplía la ROI | No se muestran contornos superpuestos; se conserva la vista de máscara. |
| Comparadores | Didáctica, OpenCV y referencia trivial «todo fondo» | Solo resultado de nuestra implementación didáctica. |
| Gráficas | Histogramas, energía, historial de máscaras y mapa de errores | Controles de uso, resultado actual y métricas; esas figuras no se han portado. |

La energía de cada corte se minimiza con modelos fijos. Como en el cuaderno,
el reajuste duro de los GMM no garantiza descenso del costo marginal entre
iteraciones. Ninguna métrica de referencia interviene en el ajuste.
