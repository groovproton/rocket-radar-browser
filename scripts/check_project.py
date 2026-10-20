#!/usr/bin/env python3
import argparse,hashlib,json,shutil,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--data',action='store_true');ap.add_argument('--manifest',action='store_true');ap.add_argument('--doctor',action='store_true');a=ap.parse_args()
 required=['Makefile','index.html','tests.html','js/main.js','js/binance/ws.js','js/indicators/inplay.js','js/indicators/detachment.js','tasks/PHASE_0_CODEX.md','docs/ARCHITECTURE.md'];bad=[x for x in required if not (ROOT/x).is_file()]
 if a.doctor:
  for tool in ['make','python3','chromium','firefox']:print(f'{tool:10} {shutil.which(tool) or "not found (optional for browser)"}')
 if a.data or a.manifest:
  manifest=json.loads((ROOT/'data/manifest.json').read_text())
  for r in manifest['archives']:
   p=ROOT/'data/raw'/r['file']
   exists=p.is_file();digest=hashlib.sha256(p.read_bytes()).hexdigest() if exists and a.data else None
   good=exists and (digest==r['sha256'] if a.data else True)
   print(f'{"OK" if good else "FAIL"} {r["file"]} ({r["size_bytes"]} bytes) sha256={r["sha256"]}')
   if not good:bad.append(r['file'])
 print(f'Project: {"OK" if not bad else "FAIL"}, {len(bad)} issues')
 if bad: print('Issues: '+', '.join(bad));sys.exit(1)
if __name__=='__main__':main()
