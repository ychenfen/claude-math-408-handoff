"""Question status tables in daily reviews: parse, derive status from attempts, check structure.

Usage: python3 scripts/ledger.py [科目]   # each question's latest status and attempt history

What this checks: every status is backed by per-question attempt records with the
required fields (how it was done, the answer or attachment, the check result, who
checked it against what, and the Q&A source). It cannot judge whether an answer is
mathematically or logically correct — that is the 核对结果 a person or assistant writes
after checking the original. The Markdown files stay canonical; this only reads them.
"""
import re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
STATUSES=['仅安排','已讨论','作答待核实','独立做对','隔日重做通过']
SUBJECTS=['高等数学','线性代数','数据结构','计算机组成原理','操作系统','计算机网络']
QUESTION_HEAD=['题目','状态','来源','卡点／错误步骤 → 更正','下次验证']
ATTEMPT_HEAD=['编号','作答方式','作答内容／附件','核对结果','核对依据','来源']
MODES=['独立','有提示','看答案后','未注明','未作答']
RESULTS=['正确','部分正确','错误','未核对']
BASES=['原件已核','仅旧助手判断','未核对']
# One question per ID. Letters, digits, CJK, '-', '.', and a trailing sub-question like (2).
# Range or list separators (～ ~ 、 , /) are rejected so a range can never be read as its endpoints.
ID=re.compile(r'^[0-9A-Za-z一-鿿]+(?:[-.][0-9A-Za-z一-鿿]+)*(?:\(\d+\))?$')
LINK=re.compile(r'\]\(([^)\s]+)\)')
QA=re.compile(r'^\.\./\.\./问答记录/([^/]+)/(\d{4}-\d{2}-\d{2})\.md$')
class LedgerError(ValueError):pass
def cells(line):return [c.strip() for c in line.strip().strip('|').split('|')]
def table(text,name,head):
    m=re.search(r'^## '+name+r'\s*$(.*?)(?=^## |\Z)',text,re.M|re.S)
    if not m:return None
    lines=[l for l in m.group(1).splitlines() if l.strip().startswith('|')]
    if len(lines)<2 or cells(lines[0])!=head:raise LedgerError(f'「{name}」表头必须是：'+' | '.join(head))
    rows=[]
    for line in lines[2:]:
        c=cells(line)
        if len(c)!=len(head):raise LedgerError(f'「{name}」每行应有{len(head)}列：{line}')
        rows.append(dict(zip(head,c)))
    return rows
def check_sources(cell,subject,date,exists,where):
    """Every link must point at an existing Q&A file of this subject, not after the review date."""
    sources=[QA.match(l) for l in LINK.findall(cell)]
    if not sources or not all(sources):raise LedgerError(f'{where}：来源必须链接本科问答记录')
    for m in sources:
        if m.group(1)!=subject:raise LedgerError(f'{where}：来源链接到了其他科目')
        if not exists(f'../../问答记录/{m.group(1)}/{m.group(2)}.md'):raise LedgerError(f'{where}：来源文件不存在')
        if m.group(2)>date:raise LedgerError(f'{where}：来源日期晚于复盘日期')
    return max(m.group(2) for m in sources)
def one_id(cell,where):
    ids=re.findall(r'`([^`]*)`',cell)
    if len(ids)!=1:raise LedgerError(f'{where}：每行只能有一个`编号`，分组或范围要拆成逐题记录')
    if not ID.match(ids[0]):raise LedgerError(f'{where}：编号`{ids[0]}`不合规，不能用范围或列表')
    return ids[0]
def parse(text,date,subject,exists=None):
    """Return (questions, attempts) of one review, or None when it has no 题目状态 table."""
    exists=exists or (lambda rel:(ROOT/'每日复盘'/subject/rel).resolve().is_file())
    qs=table(text,'题目状态',QUESTION_HEAD)
    if qs is None:return None
    attempts=table(text,'作答记录',ATTEMPT_HEAD) or []
    questions={}
    for r in qs:
        qid=one_id(r['题目'],f'{subject} {date} 题目状态')
        if qid in questions:raise LedgerError(f'{subject} {date}：编号`{qid}`重复，同一天每题只写一行')
        if r['状态'] not in STATUSES:raise LedgerError(f'{subject} {date} `{qid}`：未知状态「{r["状态"]}」')
        check_sources(r['来源'],subject,date,exists,f'{subject} {date} `{qid}`')
        questions[qid]={'id':qid,'title':r['题目'],'declared':r['状态'],'fix':r['卡点／错误步骤 → 更正'],'next':r['下次验证'],'date':date}
    out=[]
    for i,r in enumerate(attempts):
        where=f'{subject} {date} 作答记录第{i+1}行'
        qid=one_id(r['编号'],where)
        if qid not in questions:raise LedgerError(f'{where}：`{qid}`不在当天题目状态表里')
        mode,result,basis=r['作答方式'],r['核对结果'],r['核对依据']
        if mode not in MODES:raise LedgerError(f'{where}：作答方式只能是{"／".join(MODES)}')
        if result not in RESULTS:raise LedgerError(f'{where}：核对结果只能是{"／".join(RESULTS)}')
        if basis not in BASES:raise LedgerError(f'{where}：核对依据只能是{"／".join(BASES)}')
        if (result=='未核对')!=(basis=='未核对'):raise LedgerError(f'{where}：核对结果与核对依据必须同时为“未核对”或同时已填写')
        attempt_date=check_sources(r['来源'],subject,date,exists,where)
        content=r['作答内容／附件']
        if mode=='未作答':
            if content not in ('—','-','') or result!='未核对':raise LedgerError(f'{where}：未作答（如仅计划重做）不能填作答内容或核对结果')
        elif content in ('—','-',''):raise LedgerError(f'{where}：有作答就要写作答内容或附件位置')
        if basis=='原件已核':
            links=LINK.findall(content)
            if not links or not all(exists(l) for l in links):raise LedgerError(f'{where}：核对依据为“原件已核”时，作答内容必须链接仓库内存在的作答全文或原图')
        out.append({'id':qid,'mode':mode,'content':content,'result':result,'basis':basis,'source':r['来源'],'date':attempt_date,'review':date})
    return questions,out
def next_action(text):
    m=re.search(r'^## 下次先做\s*$(.*?)(?=^## |\Z)',text,re.M|re.S)
    item=m and re.search(r'^- \[ \] (.+)$',m.group(1),re.M)
    return item.group(1).strip() if item else ''
def counts(a):return a['mode']!='未作答'
def verified_independent(a):return a['mode']=='独立' and a['result']=='正确' and a['basis']=='原件已核'
def derive(attempts,discussed):
    """Status from the attempt history of one question (oldest first). Only structure is used."""
    real=[a for a in attempts if counts(a)]
    if not real:return '已讨论' if discussed else '仅安排'
    last=real[-1]
    if not verified_independent(last):return '作答待核实'
    if any(a['date']<last['date'] for a in real):return '隔日重做通过'
    return '独立做对'
def collect(subject,docs=None,exists=None):
    """Check every review of a subject in date order; return per-date results.
    docs: optional [(date, text)] for tests; defaults to the committed files."""
    if docs is None:docs=[(p.stem,p.read_text()) for p in sorted((ROOT/'每日复盘'/subject).glob('*.md'))]
    history={};days=[]
    for date,text in sorted(docs):
        parsed=parse(text,date,subject,exists)
        if parsed is None:days.append((date,None));continue
        questions,attempts=parsed
        for a in attempts:history.setdefault(a['id'],[]).append(a)
        for qid,q in questions.items():
            seen=sorted(history.get(qid,[]),key=lambda a:a['date'])
            discussed=q['declared']=='已讨论' or any(old[qid]['status']!='仅安排' for _,old in days if old and qid in old)
            q['status']=derive(seen,discussed);q['attempts']=seen
            if q['declared']!=q['status']:
                raise LedgerError(f'{subject} {date} `{qid}`：表中写“{q["declared"]}”，但作答记录只支持“{q["status"]}”')
        days.append((date,questions))
    return days
def latest(subject,docs=None,exists=None):
    """One entry per ID: the newest review's row, with its status trail across dates."""
    state={}
    for date,qs in collect(subject,docs,exists):
        for qid,q in (qs or {}).items():
            trail=state.get(qid,{}).get('trail',[])+[(date,q['status'])]
            state[qid]=dict(q,trail=trail)
    return state
if __name__=='__main__':
    for s in sys.argv[1:] or SUBJECTS:
        days=collect(s)
        if not days:print(f'{s}：没有复盘');continue
        missing=[d for d,q in days if q is None]
        print(f'## {s}'+(f'（{len(missing)}份复盘没有题目状态表：{"、".join(missing)}）' if missing else ''))
        for qid,q in latest(s).items():
            last=next((a for a in reversed(q['attempts']) if counts(a)),None)
            tail=f'｜最近作答：{last["date"]} {last["mode"]}·{last["result"]}·{last["basis"]}' if last else ''
            print(f'- {qid}｜{q["status"]}｜'+' → '.join(f'{d} {st}' for d,st in q['trail'])+tail+f'｜下次：{q["next"]}')
    print('\n说明：脚本只检查证据结构是否支持状态，不判断答案本身是否正确。')
