from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
root=Path(__file__).resolve().parents[1];out=root.parent/'rocket-radar-browser.zip'
with ZipFile(out,'w',ZIP_DEFLATED,compresslevel=6) as z:
 for f in root.rglob('*'):
  if f.is_file() and not any(x in f.parts for x in ['__pycache__','.git']) and f.name not in {'.server.log','.server.pid'}:z.write(f,Path('rocket-radar-browser')/f.relative_to(root))
print(out,round(out.stat().st_size/1048576,2),'MiB')
