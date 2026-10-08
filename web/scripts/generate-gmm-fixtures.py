"""Generate numerical references from the notebook's functions, without executing its UI."""
import ast
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np

WEB = Path(__file__).resolve().parents[1]
ROOT = WEB.parent
NOTEBOOK = ROOT / "notebooks/grabcut2.ipynb"
NAMES = {"initialize_gmm", "component_costs", "update_gmm", "gmm_cost"}
namespace = {"np": np}
found = set()
for cell in json.loads(NOTEBOOK.read_text())["cells"]:
    source = "".join(cell.get("source", []))
    if cell["cell_type"] != "code" or not any(f"def {name}(" in source for name in NAMES):
        continue
    nodes = [node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef) and node.name in NAMES]
    found.update(node.name for node in nodes)
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(NOTEBOOK), "exec"), namespace)
if found != NAMES:
    raise RuntimeError(f"Missing notebook functions: {NAMES - found}")


def model_json(model):
    return {key: value.tolist() for key, value in zip(("weights", "means", "variances"), model)}


fixtures = []
for case_id, roi in [
    ("VS-SEG-001", (180, 180, 80, 70)),
    ("VS-SEG-017", (250, 253, 89, 84)),
    ("VS-SEG-018", (140, 160, 90, 80)),
]:
    path = ROOT / "data/images" / f"{case_id}.png"
    image = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise RuntimeError(f"Could not read {path}")
    labels = np.zeros_like(image, dtype=np.uint8)
    x, y, w, h = roi
    labels[y:y+h, x:x+w] = 1
    samples = {name: image[labels == label].astype(np.float64) for label, name in enumerate(("background", "foreground"))}
    query = np.arange(256, dtype=np.float64)
    runs = []
    for k in (1, 3, 5, 8):
        classes = {}
        for name, values in samples.items():
            initial = namespace["initialize_gmm"](values, k)
            assignments = namespace["component_costs"](values, *initial).argmin(axis=-1)
            updated = namespace["update_gmm"](values, assignments, *initial)
            classes[name] = {
                "initial": model_json(initial),
                "updated": model_json(updated),
                "assignments": namespace["component_costs"](query, *initial).argmin(axis=-1).tolist(),
                "costs": namespace["gmm_cost"](query, *updated).tolist(),
            }
        runs.append({"k": k, "classes": classes})
    fixtures.append({
        "caseId": case_id,
        "imageSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "width": int(image.shape[1]), "height": int(image.shape[0]),
        "roi": {"x": x, "y": y, "width": w, "height": h},
        "histograms": {name: np.bincount(values.astype(np.uint8), minlength=256).tolist() for name, values in samples.items()},
        "runs": runs,
    })

output = {
    "source": "notebooks/grabcut2.ipynb",
    "notebookSha256": hashlib.sha256(NOTEBOOK.read_bytes()).hexdigest(),
    "numpyVersion": np.__version__, "opencvVersion": cv2.__version__,
    "description": "Exact notebook functions on original grayscale pixels. Histograms reconstruct the sample multisets without duplicating image files.",
    "fixtures": fixtures,
}
path = WEB / "tests/fixtures/gmm-python.json"
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(output, indent=2, allow_nan=False) + "\n")
print(f"Wrote {path.name}: {len(fixtures)} cases, 4 K values, 2 classes each.")
