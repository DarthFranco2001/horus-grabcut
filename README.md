# Horus GrabCut

Proyecto de segmentación interactiva de schwannoma vestibular en imágenes de resonancia magnética. Incluye un cuaderno de Python, una aplicación web en TypeScript y un reporte técnico en LaTeX.

La aplicación publicada se puede utilizar sin instalar dependencias:
[Laboratorio GrabCut](https://darthfranco2001.github.io/horus-grabcut/).

## Descargar el proyecto

```bash
git clone https://github.com/DarthFranco2001/horus-grabcut.git
cd horus-grabcut
```

También puedes descargar el repositorio como ZIP y extraerlo. Conserva la estructura de carpetas: el cuaderno y la web utilizan las imágenes de `data/`.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `notebooks/grabcut.ipynb` | Cuaderno con el procedimiento y sus resultados guardados. |
| `data/images/` | Imágenes de entrada en PNG. |
| `data/contours/` | Imágenes anotadas para calcular la referencia de evaluación. |
| `web/` | Aplicación de React y TypeScript. |
| `report/` | Fuentes de LaTeX y figuras del reporte. |
| `report/build/main.pdf` | Reporte compilado. |

## Python: instalación de dependencias

Se utiliza Python 3.12, indicado en `.python-version`, y `uv` para gestionar el entorno. Instala `uv` antes de continuar. Los comandos de esta sección se ejecutan desde la raíz del repositorio.

```bash
uv python install 3.12
uv sync --locked --group dev
```

Esto crea el entorno `.venv/` e instala las versiones registradas en `uv.lock`. Las dependencias se declaran en `pyproject.toml`:

| Dependencia | Uso |
| --- | --- |
| NumPy | Operaciones con imágenes, máscaras y modelos gaussianos. |
| Matplotlib | Gráficas y visualización de resultados. |
| ipympl | Figuras interactivas y selección del rectángulo. |
| OpenCV (`opencv-python`) | Lectura de imágenes y conversión de canales. |
| JupyterLab e ipykernel | Apertura y ejecución del cuaderno. |
| Ruff | Herramienta de revisión del código Python. |

No es necesario activar el entorno manualmente cuando se utiliza `uv run`.

### Abrir el cuaderno con JupyterLab

Desde la raíz del repositorio:

```bash
uv run --locked jupyter lab notebooks/grabcut.ipynb
```

1. Abre el cuaderno y utiliza el kernel del entorno del proyecto.
2. Ejecuta las celdas en orden hasta que aparezca el selector del rectángulo.
3. Dibuja con el botón izquierdo un rectángulo que contenga la lesión y algo de tejido circundante.
4. Continúa ejecutando las celdas para obtener la segmentación y su evaluación.
5. Guarda el cuaderno para conservar las figuras y los resultados.

La selección del rectángulo requiere interacción: al iniciar una sesión nueva, debes realizarla antes de ejecutar las celdas que utilizan `roi_state`. Para cambiar de imagen, modifica `case_id`, por ejemplo a `VS-SEG-002`, y vuelve a ejecutar desde el inicio con una nueva selección.

El directorio de trabajo del kernel debe ser `notebooks/`, porque el cuaderno busca `data/` en la carpeta superior. Si las imágenes no se cargan, comprueba esa ubicación con `Path.cwd()` después de ejecutar las importaciones.

### Abrir el cuaderno con VS Code

1. Abre la carpeta completa `horus-grabcut` en VS Code.
2. Instala las extensiones Python y Jupyter de Microsoft.
3. Abre `notebooks/grabcut.ipynb` y selecciona el entorno `.venv` como kernel.
4. Ejecuta las celdas siguiendo la selección interactiva descrita arriba.

La configuración incluida en `.vscode/settings.json` establece `notebooks/` como directorio de trabajo. La primera celda utiliza `%matplotlib widget`; si la selección no responde, comprueba que el kernel sea el del proyecto y que `ipympl` esté instalado mediante `uv sync`.

## TypeScript: instalación y ejecución de la web

La aplicación utiliza Node.js **26.3.1**, versión indicada en `web/.nvmrc`, y npm. Puedes instalar esa versión de Node.js directamente o utilizar `nvm` si ya lo tienes instalado.

Desde la raíz del repositorio, con `nvm`:

```bash
cd web
nvm install
nvm use
npm ci
npm run dev
```

Si instalaste Node.js directamente, omite los dos comandos de `nvm`. `npm ci` instala las dependencias de `package-lock.json` en `web/node_modules/`, incluyendo TypeScript, React, Grommet y Vite. No necesitas instalar TypeScript globalmente.

Abre la dirección que indique Vite, normalmente `http://localhost:5173/horus-grabcut/`. Selecciona un caso, dibuja el rectángulo y pulsa **Segmentar**. El procesamiento se realiza en el navegador; la web no necesita un servidor Python.

Vite utiliza `data/` directamente. El catálogo de casos se genera automáticamente antes de iniciar el servidor, revisar el código o compilar. Si añades imágenes mientras el servidor está abierto, reinícialo para actualizar el catálogo.

### Revisar y compilar

Desde `web/`:

```bash
npm run lint
npm test
npm run build
```

- `lint`: revisa el código con ESLint.
- `test`: ejecuta las pruebas automatizadas.
- `build`: comprueba los tipos de TypeScript y genera la aplicación en `web/dist/`.

Para visualizar localmente la compilación:

```bash
npm run preview
```

Abre la dirección mostrada en la terminal. Este comando sirve la compilación local; la publicación en GitHub Pages se gestiona mediante `.github/workflows/deploy-pages.yml`.

## Reporte

El PDF está disponible en [`report/build/main.pdf`](report/build/main.pdf). Para regenerarlo necesitas una distribución de LaTeX con `latexmk` y `pdflatex`; estas herramientas se instalan por separado de Python y Node.js.

Desde la raíz del repositorio:

```bash
cd report
latexmk -pdf -interaction=nonstopmode -halt-on-error -outdir=build main.tex
```

La receta de LaTeX Workshop incluida en VS Code utiliza la ruta de MacTeX `/Library/TeX/texbin/latexmk`. En otros sistemas, ajusta esa ruta en `.vscode/settings.json` a la ubicación de `latexmk` de tu instalación.
