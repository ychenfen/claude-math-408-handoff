"""Generate only the public site data; keep authored Markdown canonical."""
import hashlib,json,re
from pathlib import Path
from exams import load_all as load_exams
ROOT=Path(__file__).resolve().parents[1]
SUBJECTS=[('math','高等数学','01_高等数学.md','极限 · 微积分 · 错题串联','M'),('linear','线性代数','02_线性代数.md','向量 · 矩阵 · 二次型','L'),('ds','数据结构','03_数据结构.md','算法 · 图与树 · 手写代码','D'),('co','计算机组成原理','04_计算机组成原理.md','存储 · 指令 · 数据通路','C'),('os','操作系统','05_操作系统.md','进程 · 同步互斥 · 内存','O'),('net','计算机网络','06_计算机网络.md','分层 · 网络层 · TCP','')]
def doc(p):
    text=p.read_text()
    heading=re.search(r'^# (.+)$',text,re.M)
    raw=p.read_bytes()
    # gitSha equals the blob sha GitHub's contents API reports, so the page can tell whether its snapshot is current.
    return {'path':p.relative_to(ROOT).as_posix(),'title':heading.group(1) if heading else p.stem,'text':text,'sha256':hashlib.sha256(text.encode()).hexdigest(),'gitSha':hashlib.sha1(b'blob %d\0'%len(raw)+raw).hexdigest()}
def build():
    subjects=[]
    for sid,name,history,tag,prefix in SUBJECTS:
        records=[];summaries=[]
        for area,target in [('问答记录',records),('每日复盘',summaries)]:
            for p in sorted((ROOT/area/name).glob('*.md'),reverse=True):
                if not re.fullmatch(r'\d{4}-\d{2}-\d{2}\.md',p.name):raise ValueError(f'Invalid dated file: {p}')
                d=doc(p);d['date']=p.stem;target.append(d)
        diagrams=[]
        for img in sorted((ROOT/'图解'/name).glob('*')) if (ROOT/'图解'/name).is_dir() else []:
            if img.suffix.lower() not in ('.svg','.png','.jpg','.jpeg','.webp'):continue
            if img.suffix.lower()=='.svg' and re.search(r'<script|\son\w+\s*=|<foreignObject|javascript:',img.read_text(),re.I):raise ValueError(f'SVG contains executable content: {img}')
            cap=img.with_suffix('.md');caption=doc(cap) if cap.is_file() else None
            diagrams.append({'path':img.relative_to(ROOT).as_posix(),'title':caption['title'] if caption else img.stem,'caption':caption})
        subjects.append({'id':sid,'name':name,'tag':tag,'diagrams':diagrams,'history':doc(ROOT/history),'archive':[doc(p) for p in sorted((ROOT/'原文').glob(f'{prefix}*.md'))] if prefix else [],'records':records,'summaries':summaries})
    # Mock exams: score and lost points for the overview; each wrong-question card joins its subject's review queue.
    exams=[]
    for e in load_exams():
        exams.append({**doc(ROOT/e['path']),**e})
        for s in subjects:
            if s['name'] in e['cards']:s.setdefault('examCards',[]).append({'path':e['path'],'date':e['date'],'text':'\n'.join(e['cards'][s['name']])})
    dates=[r['date'] for s in subjects for r in s['records']]
    data={'version':1,'latestDate':max(dates,default=''),'subjects':subjects,'exams':exams,'protocol':doc(ROOT/'每日复盘/使用说明.md'),'examProtocol':doc(ROOT/'考试记录/使用说明.md'),'links':[doc(p) for p in sorted((ROOT/'串联').glob('*.md'))]}
    out=ROOT/'assets/data.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'subjects':len(subjects),'daily_records':len(dates),'daily_summaries':sum(len(s['summaries']) for s in subjects),'exams':len(exams),'latest':data['latestDate']},ensure_ascii=False))
if __name__=='__main__':build()
