"""Independent reference extraction and evaluation for the repository's annotations."""
import base64
import hashlib
import json
from pathlib import Path
import zlib

import cv2
import numpy as np

WEB = Path(__file__).resolve().parents[1]
ROOT = WEB.parent
cuts = json.loads((WEB / 'tests/fixtures/grabcut-python.json').read_text())
fixtures = []
for path in sorted((ROOT / 'data/contours').glob('VS-SEG-*.png')):
    annotation = cv2.imread(str(path), cv2.IMREAD_COLOR)
    image = cv2.imread(str(ROOT / 'data/images' / path.name), cv2.IMREAD_GRAYSCALE)
    assert annotation is not None and annotation.shape[:2] == image.shape
    blue, green, red = cv2.split(annotation)
    truth = ((red > green) & (red > blue)).astype(np.uint8)
    runs = []
    for case in cuts['fixtures']:
        if case['caseId'] != path.stem:
            continue
        roi = case['roi']
        region = np.zeros_like(truth, dtype=bool)
        region[roi['y']:roi['y']+roi['height'], roi['x']:roi['x']+roi['width']] = True
        for run in case['runs']:
            for iteration, entry in enumerate(run['iterations'], 1):
                prediction = np.frombuffer(zlib.decompress(base64.b64decode(entry['labelsZlibBase64'])), dtype=np.uint8).reshape(truth.shape)
                fp = int(np.count_nonzero((prediction == 1) & (truth == 0)))
                fn = int(np.count_nonzero((prediction == 0) & (truth == 1)))
                error = (prediction.astype(float) - truth.astype(float)) ** 2
                runs.append(dict(k=run['k'], iteration=iteration, roi=roi, metrics=dict(
                    falsePositives=fp, falseNegatives=fn,
                    predictedCount=int(prediction.sum()), referenceCount=int(truth.sum()),
                    referenceOutsideRoi=int(truth[~region].sum()),
                    mse=float(error.mean()), mseRoi=float(error[region].mean()),
                )))
    fixtures.append(dict(caseId=path.stem, width=image.shape[1], height=image.shape[0],
        annotationSha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        rgbaSha256=hashlib.sha256(cv2.cvtColor(annotation, cv2.COLOR_BGR2RGBA).tobytes()).hexdigest(),
        labelsSha256=hashlib.sha256(truth.tobytes()).hexdigest(),
        foregroundCount=int(truth.sum()), runs=runs))
output = dict(description='Red-dominance extraction on all annotations; NumPy metrics on notebook prediction fixtures. No ROI clipping of ground truth.',
              numpyVersion=np.__version__, opencvVersion=cv2.__version__, fixtures=fixtures)
(WEB / 'tests/fixtures/evaluation-python.json').write_text(json.dumps(output, indent=2, allow_nan=False) + '\n')
print(f'{len(fixtures)} annotations, {sum(len(f["runs"]) for f in fixtures)} comparisons.')
