import json,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import exams
class ExamTests(unittest.TestCase):
    def test_every_exam_parses_and_is_published(self):
        data=json.loads((ROOT/'assets/data.json').read_text())
        parsed=exams.load_all()
        self.assertEqual([e['path'] for e in parsed],[e['path'] for e in data['exams']])
        for e,d in zip(parsed,data['exams']):
            self.assertEqual((ROOT/e['path']).read_text(),d['text'])
            self.assertEqual(e['score']['choice']+e['score']['big'],e['score']['total'])
    def test_cards_join_their_subject_queue(self):
        data=json.loads((ROOT/'assets/data.json').read_text())
        for e in exams.load_all():
            for name,cards in e['cards'].items():
                s=next(s for s in data['subjects'] if s['name']==name)
                texts='\n'.join(c['text'] for c in s.get('examCards',[]))
                for c in cards:self.assertIn(c.split('\n')[0],texts)
    def check(self,body):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'2026-10-08_408_测试卷.md';p.write_text(body)
            old=exams.ROOT;exams.ROOT=Path(d)
            try:return exams.parse(p)
            finally:exams.ROOT=old
    GOOD="""# t\n\n## 成绩\n\n| 日期 | 科目 | 试卷 | 用时 | 选择 | 大题 | 总分 | 满分 |\n|---|---|---|---|---|---|---|---|\n| 2026-10-08 | 408 | 测试卷 | 未记 | 60 | 30 | 90 | 150 |\n\n## 逐题丢分\n\n| 题号 | 题型 | 科目 | 得分 | 满分 | 错因 | 要点 |\n|---|---|---|---|---|---|---|\n| 42 | 大题 | 数据结构 | 5 | 15 | 审题 | x |\n\n## 闭卷自测\n\n### 自测：数据结构｜一题\n\n**题干**：问题\n\n**参考要点**：答案\n\n## 下次先做\n\n- [ ] a\n\n## 来源与边界\n\n- b\n"""
    def test_valid_file(self):
        e=self.check(self.GOOD);self.assertEqual(e['score']['total'],90);self.assertEqual(list(e['cards']),['数据结构'])
    def test_rejects_bad_total_cause_and_subject(self):
        for old,new,msg in [('| 90 |','| 91 |','总分'),('| 审题 |','| 没复习 |','错因'),('| 数据结构 | 5','| 数据 | 5','科目'),('### 自测：数据结构｜','### 自测：','六科名')]:
            with self.assertRaisesRegex(ValueError,msg):self.check(self.GOOD.replace(old,new))
if __name__=='__main__':unittest.main()
