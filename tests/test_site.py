import hashlib,json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class SiteTests(unittest.TestCase):
    def setUp(self):self.data=json.loads((ROOT/'assets/data.json').read_text())
    def test_six_subjects(self):
        self.assertEqual(len(self.data['subjects']),6)
        self.assertEqual(len({s['id'] for s in self.data['subjects']}),6)
    def test_canonical_documents(self):
        for s in self.data['subjects']:
            for d in [s['history'],*s['archive'],*s['records'],*s['summaries']]:
                text=(ROOT/d['path']).read_text();self.assertEqual(d['text'],text)
                self.assertEqual(d['sha256'],hashlib.sha256(text.encode()).hexdigest())
            for d in s['records']+s['summaries']:
                self.assertIn('/'+s['name']+'/',d['path'])
                self.assertRegex(d['date'],r'^\d{4}-\d{2}-\d{2}$')
    def test_legacy_preserved(self):
        self.assertEqual(hashlib.sha256((ROOT/'问答记录/2026-10-05.md').read_bytes()).hexdigest(),'dfe954abf802b8f3b23b19d68be6be26fd78018e47eca11030c1eec53c046d40')
    def test_split_complete(self):
        old=(ROOT/'问答记录/2026-10-05.md').read_text()
        sections=re.findall(r'^## (.+)$',old,re.M)
        new='\n'.join((ROOT/f'问答记录/{s}/2026-10-05.md').read_text() for s in ['操作系统','数据结构','计算机网络'])
        for section in sections:self.assertEqual(new.count('## '+section),1)
    def test_questions_have_answers_and_sources(self):
        for s in self.data['subjects']:
            for d in s['summaries']:
                t=d['text'];questions=re.findall(r'^### 自测：',t,re.M)
                self.assertGreaterEqual(len(questions),3)
                self.assertEqual(len(questions),t.count('**参考要点**'))
                for body in re.findall(r'^### 自测：[^\n]+\n([\s\S]*?)(?=^#{1,3} |\Z)',t,re.M):
                    self.assertIn('**题干**：',body,d['path'])
                    self.assertLess(body.index('**题干**：'),body.index('**参考要点**'),d['path'])
                    self.assertGreater(len(body.split('**参考要点**')[0].strip()),60,d['path'])
                self.assertIn('## 来源与边界',t)
                for target in re.findall(r'\]\((\.\./[^)]+)\)',t):self.assertTrue((ROOT/d['path']).parent.joinpath(target).is_file())
    def test_every_summary_has_same_day_evidence(self):
        for s in self.data['subjects']:
            recorded={d['date'] for d in s['records']}
            for d in s['summaries']:self.assertIn(d['date'],recorded)
    def test_vendors_present(self):
        for p in ['marked.umd.js','purify.min.js','katex/katex.min.js','katex/katex.min.css','katex/contrib/auto-render.min.js']:
            self.assertTrue((ROOT/'assets/vendor'/p).is_file())
    def test_oct6_ds_record_is_not_lost(self):
        self.assertEqual((ROOT/'问答记录/2026-10-06.md').read_text(),(ROOT/'问答记录/数据结构/2026-10-06.md').read_text())
        ds=next(s for s in self.data['subjects'] if s['id']=='ds')
        self.assertIn('2026-10-06',{d['date'] for d in ds['records']})
if __name__=='__main__':unittest.main()
