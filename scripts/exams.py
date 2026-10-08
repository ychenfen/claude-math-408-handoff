"""Parse and check 考试记录/*.md (full-paper mock exams), and print a score / lost-points summary."""
import re,sys
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SUBJECTS=['高等数学','线性代数','数据结构','计算机组成原理','操作系统','计算机网络']
CAUSES=['概念不清','模板没掌握','审题','计算漏步','同步顺序','没做完','知识点不会','表述','粗心','待补']
KINDS=['选择','填空','大题']
NAME_RE=re.compile(r'\d{4}-\d{2}-\d{2}_(408|数学二)_[^/]+\.md')
CARD_RE=re.compile(r'^### 自测：([^\n]+)\n([\s\S]*?)(?=^#{1,3} |\Z)',re.M)
def section(text,name):
    m=re.search(r'^## '+name+r'\s*$([\s\S]*?)(?=^## |\Z)',text,re.M);return m.group(1) if m else None
def rows(body):return [[c.strip() for c in l.strip().strip('|').split('|')] for l in body.splitlines() if l.strip().startswith('|')][2:]
def num(s):
    try:return float(s)
    except ValueError:return None
def parse(path):
    """Return the exam's score, lost items and per-subject cards; raise ValueError listing every problem."""
    text=path.read_text();errs=[]
    if not NAME_RE.fullmatch(path.name):errs.append('文件名应为 YYYY-MM-DD_408或数学二_试卷.md')
    for name in ['成绩','逐题丢分','闭卷自测','下次先做','来源与边界']:
        if section(text,name) is None:errs.append(f'缺少「## {name}」')
    score=None
    r=rows(section(text,'成绩') or '')
    if len(r)!=1 or len(r[0])!=8:errs.append('「成绩」应是一行 8 列：日期｜科目｜试卷｜用时｜选择｜大题｜总分｜满分')
    else:
        d,subj,paper,used,choice,big,total,full=r[0];v=[num(x) for x in (choice,big,total,full)]
        if None in v:errs.append('选择、大题、总分、满分必须是数字')
        elif v[0]+v[1]!=v[2]:errs.append(f'总分 {total} ≠ 选择 {choice} + 大题 {big}')
        elif v[2]>v[3]:errs.append('总分超过满分')
        if d!=path.name[:10]:errs.append(f'成绩日期 {d} 与文件名不一致')
        if subj!=path.name.split('_')[1]:errs.append(f'成绩科目 {subj} 与文件名不一致')
        if None not in v:score={'date':d,'subject':subj,'paper':paper,'time':used,'choice':v[0],'big':v[1],'total':v[2],'full':v[3]}
    items=[]
    for c in rows(section(text,'逐题丢分') or ''):
        if len(c)!=7:errs.append(f'逐题丢分一行应有 7 列：{"|".join(c)}');continue
        qid,kind,subj,got,full,cause,note=c;g,f=num(got),num(full)
        if kind not in KINDS:errs.append(f'{qid} 题型「{kind}」不在 {"／".join(KINDS)} 中')
        if subj not in SUBJECTS:errs.append(f'{qid} 科目「{subj}」不是六科名')
        if cause not in CAUSES:errs.append(f'{qid} 错因「{cause}」不在固定列表中')
        if g is None or f is None or not 0<=g<f:errs.append(f'{qid} 得分 {got}／满分 {full} 不合理（丢分题得分应小于满分）');continue
        items.append({'id':qid,'kind':kind,'subject':subj,'got':g,'full':f,'cause':cause,'note':note})
    cards={}
    for title,body in CARD_RE.findall(section(text,'闭卷自测') or ''):
        subj=title.split('｜',1)[0].strip()
        if subj not in SUBJECTS:errs.append(f'自测「{title}」要以六科名加“｜”开头');continue
        if '**题干**：' not in body or '**参考要点**' not in body or body.index('**题干**：')>body.index('**参考要点**'):errs.append(f'自测「{title}」需要先题干、后参考要点');continue
        cards.setdefault(subj,[]).append(f'### 自测：{title}\n{body}')
    if errs:raise ValueError(f'{path.relative_to(ROOT)}：'+'；'.join(errs))
    return {'path':path.relative_to(ROOT).as_posix(),'date':path.name[:10],'score':score,'items':items,'cards':cards}
def load_all():return [parse(p) for p in sorted((ROOT/'考试记录').glob('*.md')) if p.name!='使用说明.md']
def main():
    exams=load_all()
    if not exams:print('还没有考试记录');return
    print('## 成绩走势\n')
    for e in exams:s=e['score'];print(f"- {s['date']} {s['subject']} {s['paper']}：{s['total']:g}/{s['full']:g}（选择 {s['choice']:g}，大题 {s['big']:g}）")
    for subj in sorted({e['score']['subject'] for e in exams}):
        last=[e for e in exams if e['score']['subject']==subj][-1];lost=Counter()
        for it in last['items']:lost[it['subject']]+=it['full']-it['got']
        print(f"\n## 最近一次 {subj}（{last['score']['paper']}）按科目丢分\n");[print(f'- {k}：{v:g} 分') for k,v in lost.most_common()]
    causes=Counter(it['cause'] for e in exams for it in e['items'] if it['cause']!='待补')
    print('\n## 错因累计\n');[print(f'- {k}：{v} 次') for k,v in causes.most_common()]
    todo=sum(it['cause']=='待补' for e in exams for it in e['items'])
    if todo:print(f'\n还有 {todo} 道题的错因待补。')
if __name__=='__main__':
    try:main()
    except ValueError as e:sys.exit(str(e))
