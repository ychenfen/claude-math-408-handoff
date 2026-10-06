"""Generate only the public site data; keep authored Markdown canonical."""
import hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SUBJECTS=[('math','高等数学','01_高等数学.md','极限 · 微积分 · 错题串联','M'),('linear','线性代数','02_线性代数.md','向量 · 矩阵 · 二次型','L'),('ds','数据结构','03_数据结构.md','算法 · 图与树 · 手写代码','D'),('co','计算机组成原理','04_计算机组成原理.md','存储 · 指令 · 数据通路','C'),('os','操作系统','05_操作系统.md','进程 · 同步互斥 · 内存','O'),('net','计算机网络','06_计算机网络.md','分层 · 网络层 · TCP','')]
def doc(p):
    text=p.read_text()
    heading=re.search(r'^# (.+)$',text,re.M)
    return {'path':p.relative_to(ROOT).as_posix(),'title':heading.group(1) if heading else p.stem,'text':text,'sha256':hashlib.sha256(text.encode()).hexdigest()}
def build():
    subjects=[]
    for sid,name,history,tag,prefix in SUBJECTS:
        records=[];summaries=[]
        for area,target in [('问答记录',records),('每日复盘',summaries)]:
            for p in sorted((ROOT/area/name).glob('*.md'),reverse=True):
                if not re.fullmatch(r'\d{4}-\d{2}-\d{2}\.md',p.name):raise ValueError(f'Invalid dated file: {p}')
                d=doc(p);d['date']=p.stem;target.append(d)
        subjects.append({'id':sid,'name':name,'tag':tag,'history':doc(ROOT/history),'archive':[doc(p) for p in sorted((ROOT/'原文').glob(f'{prefix}*.md'))] if prefix else [],'records':records,'summaries':summaries})
    dates=[r['date'] for s in subjects for r in s['records']]
    data={'version':1,'latestDate':max(dates,default=''),'subjects':subjects,'protocol':doc(ROOT/'每日复盘/使用说明.md')}
    out=ROOT/'assets/data.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'subjects':len(subjects),'daily_records':len(dates),'daily_summaries':sum(len(s['summaries']) for s in subjects),'latest':data['latestDate']},ensure_ascii=False))
if __name__=='__main__':build()
