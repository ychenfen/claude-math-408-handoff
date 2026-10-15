"""Validate question counts, scores, option sets, image links, and audit hashes."""
from pathlib import Path
import hashlib,json,re
root=Path(__file__).resolve().parents[1]
audit=json.loads((root/'audit/questions.json').read_text())
assert len(audit)==385
for year in range(2010,2027):
    text=(root/f'chapters/{year}.md').read_text()
    blocks=re.findall(r'^### 第 (\d+) 题（(\d+) 分）\n([\s\S]*?)(?=\n<!--)',text,re.M)
    expected=23 if year<=2020 else 22
    assert [int(b[0]) for b in blocks]==list(range(1,expected+1)),year
    assert sum(int(b[1]) for b in blocks)==150,year
    for q,s,body in blocks:
        if int(q)<=(8 if year<=2020 else 10):
            assert re.findall(r'^([ABCD])\. ',body,re.M)==list('ABCD'),(year,q)
        question=f'### 第 {q} 题（{s} 分）\n'+body.rstrip()
        row=next(r for r in audit if r['year']==year and r['question']==int(q))
        assert hashlib.sha256(question.encode()).hexdigest()==row['question_sha256'],(year,q)
        assert row['reference'] and row['status']=='visually-compared-and-corrected'
    for image in re.findall(r'!\[[^]]*\]\(([^)]+)\)',text):
        assert (root/'chapters'/image).is_file(),image
print('PASS: 17 papers, 385 question hashes, 150 points per paper, A-D options, image links.')
