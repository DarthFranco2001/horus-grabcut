"""Reference cuts using the notebook's numerical functions and spatial cells only."""
import ast
from collections import deque
import base64
import hashlib
import json
from pathlib import Path
import zlib

import cv2
import numpy as np

WEB = Path(__file__).resolve().parents[1]
ROOT = WEB.parent
NOTEBOOK = ROOT / 'notebooks/grabcut2.ipynb'
cells = [''.join(c['source']) for c in json.loads(NOTEBOOK.read_text())['cells'] if c['cell_type'] == 'code']
names = {'initialize_gmm', 'component_costs', 'update_gmm', 'gmm_cost', 'add_edge', 'build_graph', 'residual_levels', 'maximum_flow', 'didactic_grabcut'}
namespace = {'np': np, 'deque': deque}
found = set()
for source in cells:
    if not any(f"def {name}(" in source for name in names):
        continue
    nodes = [node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef) and node.name in names]
    found.update(node.name for node in nodes)
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(NOTEBOOK), 'exec'), namespace)
assert found == names
# These prefixes are the actual spatial calculations, without plots or notebook UI.
spatial_source = next(s for s in cells if s.startswith('height, width = image.shape')).split('horizontal_weights =')[0]
roi_source = next(s for s in cells if s.startswith('local_ids =')).split('roi_costs =')[0]
fixtures = []
for case_id, roi, ks in [
    ('VS-SEG-001', (180, 180, 80, 70), (5,)),
    ('VS-SEG-017', (250, 253, 89, 84), (1, 5, 8)),
    ('VS-SEG-018', (140, 160, 90, 80), (5,)),
]:
    path = ROOT / 'data/images' / f'{case_id}.png'
    image = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    assert image is not None
    x, y, w, h = roi
    roi_mask = np.zeros_like(image, dtype=bool)
    roi_mask[y:y+h, x:x+w] = True
    namespace.update(image=image, values=image.astype(np.float64), roi_mask=roi_mask)
    exec(spatial_source, namespace)
    namespace['edge_weights'] *= 10.0 / namespace['gamma']
    exec(roi_source, namespace)
    runs = []
    for k in ks:
        _, masks, diagnostics = namespace['didactic_grabcut'](
            image, roi_mask, namespace['roi_edges'], namespace['roi_weights'], namespace['boundary_cost'], K=k, iterations=3)
        runs.append({'k': k, 'iterations': [
            {'labelsZlibBase64': base64.b64encode(zlib.compress(mask.tobytes())).decode(),
             'changed': int(diagnostic[0]), 'energyBefore': float(diagnostic[1]), 'energyAfter': float(diagnostic[2]),
             'foregroundCount': int(mask.sum())}
            for mask, diagnostic in zip(masks[1:], diagnostics)
        ]})
        print(f'{case_id} K={k}: {[int(m.sum()) for m in masks[1:]]}', flush=True)
    fixtures.append({
        'caseId': case_id, 'imageSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'pixelsSha256': hashlib.sha256(image.tobytes()).hexdigest(),
        'roi': dict(x=x, y=y, width=w, height=h), 'beta': namespace['beta'], 'runs': runs,
    })
output = {
    'source': 'notebooks/grabcut2.ipynb', 'notebookSha256': hashlib.sha256(NOTEBOOK.read_bytes()).hexdigest(),
    'gamma': 10, 'numpyVersion': np.__version__, 'opencvVersion': cv2.__version__,
    'description': 'Exact notebook spatial cells and numerical functions. Three successive cuts; energies exclude the constant outside-ROI unary term.',
    'fixtures': fixtures,
}
(WEB / 'tests/fixtures/grabcut-python.json').write_text(json.dumps(output, indent=2, allow_nan=False) + '\n')
