import json,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
class RepoTests(unittest.TestCase):
 def test_index(self):self.assertIn('type="module"',(ROOT/'index.html').read_text())
 def test_no_backend(self):self.assertFalse((ROOT/'go.mod').exists());self.assertFalse((ROOT/'package.json').exists())
 def test_dataset(self):
  entries=json.loads((ROOT/'data/manifest.json').read_text())['archives'];self.assertEqual(len(entries),6)
  for e in entries:
   with zipfile.ZipFile(ROOT/'data/raw'/e['file']) as z:self.assertTrue(any(n.endswith('futures_klines_1m.csv') for n in z.namelist()))
if __name__=='__main__':unittest.main()
