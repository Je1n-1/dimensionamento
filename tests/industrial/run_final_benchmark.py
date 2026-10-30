"""Run manually from repository root: python -X utf8 tests/industrial/run_final_benchmark.py."""
import io
import json
import sys
import time
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(ROOT),str(ROOT/'tests')]
from industrial.audit_fixture import installation
from voltcalc.industrial.overview import calculate_project
from voltcalc.industrial.reports import build_report,csv_report
from voltcalc.industrial.report_pdf import render_pdf
from pypdf import PdfReader

p=installation();measurements={}
def timed(name,fn):
    start=time.perf_counter();result=fn();measurements[name]=round(time.perf_counter()-start,4);return result
a=timed('overview_seconds',lambda:calculate_project(p))
r=timed('report_seconds',lambda:build_report(p))
csv=timed('csv_seconds',lambda:csv_report(r))
pdf=timed('pdf_seconds',lambda:render_pdf(r))
reader=PdfReader(io.BytesIO(pdf))
texts=timed('pdf_extraction_seconds',lambda:[page.extract_text() for page in reader.pages])
assert all(f'Página {i+1}' in text for i,text in enumerate(texts))
assert all(c['tag'] in '\n'.join(texts) for c in p['consumers'])
assert 'Verificação parcial' in texts[0]
out=ROOT/'tmp';out.mkdir(exist_ok=True)
(out/'industrial-stage11-benchmark.pdf').write_bytes(pdf)
(out/'industrial-stage11-benchmark.csv').write_text(csv,encoding='utf-8')
(out/'industrial-stage11-backup.json').write_text(json.dumps(dict(format='voltcalc-industrial-project',version=1,
    exportedAt=datetime.now(timezone.utc).isoformat(),contractVersion=9,project=p),ensure_ascii=False,indent=2),encoding='utf-8')
measurements.update(consumers=30,panels=4,circuits=30,segments=33,pdf_pages=len(reader.pages),pdf_bytes=len(pdf),
    csv_bytes=len(csv.encode('utf-8')),backup_bytes=(out/'industrial-stage11-backup.json').stat().st_size,
    report_bytes=len(json.dumps(r,ensure_ascii=False).encode('utf-8')),summary=a['summary'],
    statuses={domain:{status:sum(row['status']==status for row in a[domain]['results']) for status in ['calculated','pending','review']} for domain in ['conductors','infrastructure','voltage']})
(out/'industrial-stage11-benchmark.json').write_text(json.dumps(measurements,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(measurements,indent=2,ensure_ascii=False))
