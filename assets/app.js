/* Static public reader. No credentials, write API or automatic chat ingestion. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const RAW = 'https://raw.githubusercontent.com/ychenfen/claude-math-408-handoff/main/';
  const API = 'https://api.github.com/repos/ychenfen/claude-math-408-handoff/contents/';
  let data, subject, date, mode = 'subject', tab = 'daily', generation = 0, currentText = '', storageOK = true;
  const memo = {}, synced = new Map();
  let disposeDrill = () => {};
  const STATUSES = ['仅安排','已讨论','作答待核实','独立做对','隔日重做通过'];
  const STATUS_NOTE = {'仅安排':'计划，未讨论','已讨论':'看过讲解，没有作答','作答待核实':'有作答，未达独立＋正确＋原件已核','独立做对':'独立作答，对照原件核对正确','隔日重做通过':'另一天再次独立做对'};
  const TABS = ['daily','records','drill','ledger','history','handoff'];
  const ID_RE = /^[0-9A-Za-z一-鿿]+(?:[-.][0-9A-Za-z一-鿿]+)*(?:\(\d+\))?$/;
  const section = (text,name) => { const m=text.match(new RegExp('^## '+name+'\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))','m')); return m?m[1]:null; };
  const rowsOf = body => body.split('\n').filter(l=>l.trim().startsWith('|')).slice(2).map(l=>l.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim()));
  const idOf = cell => { const ids=[...cell.matchAll(/`([^`]*)`/g)].map(m=>m[1]); return ids.length===1&&ID_RE.test(ids[0])?ids[0]:null; };
  const qaDate = cell => [...cell.matchAll(/\]\([^)]*问答记录\/[^/]+\/(\d{4}-\d{2}-\d{2})\.md\)/g)].map(m=>m[1]).sort().pop()||'';
  // Mirrors scripts/ledger.py: status comes from the attempt log; the table's own value is only compared.
  function parseReview(text) {
    const qBody=section(text||'','题目状态');if(qBody===null)return null;
    const problems=[],questions=new Map();
    rowsOf(qBody).forEach(c=>{const id=idOf(c[0]||'');if(!id){problems.push(`编号不合规（需一题一个编号，不能写范围）：${c[0]}`);return;}if(questions.has(id)){problems.push(`编号重复：${id}`);return;}questions.set(id,{id,title:c[0],declared:c[1],source:c[2]||'',fix:c[3]||'',next:c[4]||''});});
    const attempts=rowsOf(section(text,'作答记录')||'').map(c=>({id:idOf(c[0]||''),mode:c[1],content:c[2]||'',result:c[3],basis:c[4],source:c[5]||'',date:qaDate(c[5]||'')})).filter(a=>a.id&&questions.has(a.id));
    return {questions,attempts,problems};
  }
  const counts = a => a.mode!=='未作答';
  const verified = a => a.mode==='独立'&&a.result==='正确'&&a.basis==='原件已核'&&/\]\(/.test(a.content);
  function derive(attempts,discussed) {
    const real=attempts.filter(counts);if(!real.length)return discussed?'已讨论':'仅安排';
    const last=real[real.length-1];if(!verified(last))return '作答待核实';
    return real.some(a=>a.date<last.date)?'隔日重做通过':'独立做对';
  }
  // Per-question latest status for one subject, derived from every review's attempt log (oldest first).
  async function ledgerOf(s) {
    const docs=[...s.summaries].sort((a,b)=>a.date.localeCompare(b.date));
    for(const d of docs)await loadDoc(d);
    const items=new Map(),missing=[],problems=[];
    docs.forEach(d=>{
      const parsed=parseReview(d.text);if(parsed===null){missing.push(d.date);return;}
      parsed.problems.forEach(x=>problems.push(`${d.date}：${x}`));
      parsed.questions.forEach((q,id)=>{
        const it=items.get(id)||{trail:[],attempts:[],discussed:false};
        it.attempts.push(...parsed.attempts.filter(a=>a.id===id));it.attempts.sort((a,b)=>a.date.localeCompare(b.date));
        it.discussed=it.discussed||q.declared==='已讨论'||it.trail.some(([,s])=>s!=='仅安排');
        const status=derive(it.attempts,it.discussed);
        if(q.declared!==status)problems.push(`${d.date} ${id}：表中写“${q.declared}”，作答记录只支持“${status}”，此处按证据显示`);
        Object.assign(it,q,{status,path:d.path});it.trail.push([d.date,status]);items.set(id,it);
      });
    });
    return {items,missing,problems,docs};
  }
  // Review cards come from daily reviews plus this subject's wrong questions in 考试记录 (already inlined in data.json).
  const cardDocs = s => [...s.summaries,...(s.examCards||[])];
  // Mock exams: score trend, where the latest paper lost points, and recurring causes. Recorded scores only; nothing is graded here.
  function examBoard() {
    const exams=data.exams||[],box=document.createElement('section');box.className='exam-board';
    const kinds=[...new Set(exams.map(e=>e.score.subject))];
    const lostOf=e=>{const m=new Map();e.items.forEach(it=>m.set(it.subject,(m.get(it.subject)||0)+it.full-it.got));return [...m].sort((a,b)=>b[1]-a[1]);};
    const causes=new Map();exams.forEach(e=>e.items.forEach(it=>{if(it.cause!=='待补')causes.set(it.cause,(causes.get(it.cause)||0)+1);}));
    const todo=exams.reduce((n,e)=>n+e.items.filter(it=>it.cause==='待补').length,0);
    const latest=exams[exams.length-1];
    box.innerHTML=`<div class="eb-head"><span class="eyebrow">EXAMS · 整卷模拟</span><h2>${latest?`最近 ${latest.score.total} / ${latest.score.full}<small>${escape(latest.score.subject+' · '+latest.score.paper+' · '+latest.date.slice(5))}</small>`:'还没有整卷记录'}</h2><p>${latest?'成绩照记录显示，估分方式见各卷「成绩」小节。错题自测已进入对应科目的闭卷自测和睡前复习。':'做完一套整卷，按考试记录/使用说明.md新建一个文件，这里会显示成绩走势和丢分。'}</p></div>`;
    kinds.forEach(kind=>{
      const list=exams.filter(e=>e.score.subject===kind),last=list[list.length-1],lost=lostOf(last),most=Math.max(1,...lost.map(x=>x[1]));
      const g=document.createElement('div');g.className='eb-group';
      g.innerHTML=`<div class="eb-trend"><b>${escape(kind)} 成绩走势</b>${list.map(e=>`<div class="eb-score"><span>${escape(e.date.slice(5)+' '+e.score.paper)}</span><i style="--w:${(100*e.score.total/e.score.full).toFixed(1)}%" data-tip="选择 ${e.score.choice} · 大题 ${e.score.big}"></i><strong>${e.score.total}</strong></div>`).join('')}</div><div class="eb-lost"><b>最近一卷按科目丢分</b>${lost.map(([s,n])=>`<div class="eb-score"><span>${escape(s)}</span><i class="lost" style="--w:${(100*n/most).toFixed(1)}%"></i><strong>${n}</strong></div>`).join('')||'<span class="muted">没有丢分记录</span>'}</div>`;
      box.append(g);
    });
    if(causes.size||todo){const c=document.createElement('p');c.className='eb-causes';c.textContent='错因累计：'+[...causes].sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${k} ${n}`).join(' · ')+(todo?`（另有 ${todo} 题错因待补）`:'');box.append(c);}
    [...exams].reverse().forEach(e=>{const d=document.createElement('details');d.className='archive eb-paper';const s=document.createElement('summary');s.textContent=`${e.date} ${e.score.subject} ${e.score.paper} · ${e.score.total} 分 · 丢分题 ${e.items.length} 道`;d.append(s);d.ontoggle=()=>{if(d.open&&!d.querySelector('article'))d.append(renderMarkdown(e.text,e.path));};box.append(d);});
    return box;
  }
  function nextAction(text) { const body=section(text||'','下次先做');const m=body&&body.match(/^- \[ \] (.+)$/m);return m?m[1].trim():''; }
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const encodePath = p => p.split('/').map(encodeURIComponent).join('/');
  const localDate = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function get(key) { try { return localStorage.getItem(key) || ''; } catch { storageOK = false; return memo[key] || ''; } }
  function put(key, value) { memo[key] = value; try { localStorage.setItem(key,value); } catch { storageOK = false; notify('浏览器存储不可用，请导出备份；本次内容仅临时保留。'); } }
  const key = type => `study-v1:${subject.id}:${date}:${type}`;
  function notify(message) { const t=$('#toast');t.textContent=message;t.hidden=false;clearTimeout(t.timer);t.timer=setTimeout(()=>t.hidden=true,4000); }
  async function request(url) { const r=await fetch(url,{signal:AbortSignal.timeout(12000),credentials:'omit'});if(!r.ok)throw Error(`HTTP ${r.status}`);return r; }
  function renderMarkdown(text,path) {
    const el=document.createElement('article');el.className='markdown';
    // Shield TeX from Markdown: otherwise \\ (matrix rows), \{ \} \, and * _ inside $...$ are eaten before KaTeX sees them.
    const tex=[];
    const shielded=String(text).replace(/(```[\s\S]*?```|`[^`\n]*`)|\$\$[\s\S]+?\$\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|\$(?=\S)(?:\\\$|[^$\n])+?\$/g,(m,code)=>code?m:`@@TEX${tex.push(m)-1}@@`);
    const html=marked.parse(shielded).replace(/@@TEX(\d+)@@/g,(m,i)=>escape(tex[Number(i)]));
    el.innerHTML=DOMPurify.sanitize(html,{FORBID_TAGS:['style','iframe','form','input','svg'],FORBID_ATTR:['style']});
    const base=new URL(encodePath(path),new URL('./',location.href));
    el.querySelectorAll('a[href],img[src]').forEach(node=>{
      const attr=node.tagName==='IMG'?'src':'href',value=node.getAttribute(attr);
      try { const u=new URL(value,base);if(!['http:','https:'].includes(u.protocol)){node.removeAttribute(attr);return;}node.setAttribute(attr,u.href); } catch {node.removeAttribute(attr);}
      if(node.tagName==='A'){node.target='_blank';node.rel='noopener noreferrer';}
    });
    el.querySelectorAll('h3').forEach(h=>{
      if(!h.textContent.startsWith('自测：'))return;
      const box=document.createElement('details');box.className='selftest';
      const summary=document.createElement('summary');summary.textContent=h.textContent.replace(/^自测：/,'');box.append(summary);
      const answer=document.createElement('div');answer.className='answer';
      const context=document.createElement('div');context.className='drill-context';
      const nodes=[];
      let next=h.nextSibling;
      while(next && !(next.nodeType===1 && /^H[123]$/.test(next.tagName))){nodes.push(next);next=next.nextSibling;}
      const marker=nodes.findIndex(n=>n.nodeType===1&&n.tagName==='P'&&/^参考要点[：:]/.test(n.textContent));
      nodes.forEach((node,i)=>(marker>0&&i<marker?context:answer).append(node));
      box.append(answer);
      if(context.textContent.trim()) {
        const wrapper=document.createElement('section');wrapper.className='selftest-item';
        h.replaceWith(wrapper);wrapper.append(h,context,box);summary.textContent='查看参考要点';
      } else h.replaceWith(box);
    });
    el.querySelectorAll('td').forEach(td=>{if(STATUSES.includes(td.textContent.trim())){td.innerHTML=`<span class="status s${STATUSES.indexOf(td.textContent.trim())}">${escape(td.textContent.trim())}</span>`;}});
    StudyReview.enhanceFigures(el);
    if(window.renderMathInElement)renderMathInElement(el,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false},{left:'\\(',right:'\\)',display:false},{left:'\\[',right:'\\]',display:true}],throwOnError:false,trust:false});
    return el;
  }
  function prompt() {
    return `你负责【${subject.name}】。请先读 https://github.com/ychenfen/claude-math-408-handoff 的 AGENTS.md、每日复盘/使用说明.md 和该科历史交接。\n\n请按北京时间 ${date}，先看本科最近一份复盘的「题目状态」和「下次先做」，再读取 问答记录/${subject.name}/${date}.md 的真实记录，总结今天实际涉及的内容、逐题状态（仅安排／已讨论／作答待核实／独立做对／隔日重做通过，沿用题目编号，没有作答证据不升级）、知识点及适用条件、我的具体卡点与纠正、3～5个闭卷自测（至少一题迁移）和最多3项下一步动作。引用原问答；没有作答、原图或教材就标未核实，不把计划当完成、不混入其他科目。\n\n按 每日复盘/模板.md 保存到 每日复盘/${subject.name}/${date}.md。后续每次答疑追加到该科当天问答。请先给我核对公开内容；只有我授权上传时再提交GitHub，不覆盖其他助手改动。`;
  }
  function summaryDoc() { return subject.summaries.find(d=>d.date===date); }
  function recordDoc() { return subject.records.find(d=>d.date===date); }
  function download(text,name) {const a=document.createElement('a');const u=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  function empty(title,body) {
    $('#content').innerHTML=`<div class="empty"><div class="empty-icon">○</div><h2>${escape(title)}</h2><p>${escape(body)}</p><button class="secondary" id="empty-copy">把今天交给本科助手 ↗</button></div>`;
    $('#empty-copy').onclick=copyPrompt;
  }
  function updateChrome() {
    document.body.classList.toggle('all-mode',mode==='all');
    $('#all-link').setAttribute('aria-current',mode==='all');
    document.title=`${subject.name} · 温故学习工作台`;
    $('#subject-title').textContent=subject.name;$('#tagline').textContent=subject.tag;$('#date').value=date;
    $('#eyebrow').textContent=`SUBJECT ${String(data.subjects.indexOf(subject)+1).padStart(2,'0')} / 六科独立记录`;
    $('#subjects').innerHTML=data.subjects.map((s,i)=>`<button class="subject" data-subject="${s.id}" aria-current="${mode!=='all'&&s===subject}"><span class="num">0${i+1}</span>${escape(s.name)}${s.records.length?'<i class="dot"></i>':''}</button>`).join('');
    $('#subjects').querySelectorAll('button').forEach(b=>b.onclick=()=>select(b.dataset.subject,null,'daily'));
    if(mode==='all'){document.title='六科总览 · 温故学习工作台';$('#subject-title').textContent='六科总览';$('#tagline').textContent='先看哪科卡着，再进该科做题';$('#eyebrow').textContent='OVERVIEW / 数学二 + 408';$('#overview').innerHTML='';$('#sync-state').textContent='发布快照 · 已检查科目会合并GitHub新记录';return;}
    const available=Boolean(summaryDoc());
    const next=available?nextAction(summaryDoc().text).replace(/`/g,''):'';
    $('#overview').innerHTML=`<div class="metric"><div class="mark">↗</div><div><b>${next?'下次先做':available?'这一天，已有复盘':recordDoc()?'已有问答 · 等待整理':'这一天，尚无记录'}</b><span class="${next?'next-action':''}">${next?escape(next):available?'先闭卷回想，再展开参考要点':recordDoc()?'记录不是完成，先确认再归纳':'留白真实，比补写可靠'}</span></div></div><div class="metric"><strong>${subject.records.length}</strong><div><b>天问答</b><span>本科独立保存</span></div></div><div class="metric"><strong>${subject.archive.length}</strong><div><b>历史主题</b><span>不是掌握数量</span></div></div>`;
    document.querySelectorAll('[data-tab]').forEach(b=>{b.setAttribute('aria-selected',b.dataset.tab===tab);b.tabIndex=b.dataset.tab===tab?0:-1;});
    const reviewed=get(key('reviewed'))==='yes';$('#reviewed').textContent=reviewed?'✓ 已标记复盘 · 点击撤销':'标记本次已复盘';$('#reviewed').classList.toggle('done',reviewed);$('#reviewed').disabled=!available;
    $('#review-state').textContent=storageOK?'仅当前浏览器的自报标记，不代表掌握':'存储不可用，请导出；标记仅临时保留';
    $('#draft').value=get(key('draft'));
    $('#sync-state').textContent=synced.get(subject.id)||'已加载发布快照';
  }
  async function loadDoc(doc) {
    if(doc.text!==undefined)return doc;
    const r=await request(RAW+encodePath(doc.path));const t=await r.text();if(t.length>500000)throw Error('文件过大');doc.text=t;return doc;
  }
  const today = localDate();
  const daysBetween = (a,b) => Math.round((Date.parse(b)-Date.parse(a))/864e5);
  async function renderAll(own) {
    const pane=$('#content');pane.innerHTML='<p>正在汇总六科…</p>';
    const rows=[];for(const s of data.subjects){rows.push({s,L:await ledgerOf(s)});if(own!==generation)return;}
    pane.innerHTML='';
    // Today's spaced recall comes first: each subject's due and not-yet-seen cards.
    const dues=rows.map(({s})=>({s,d:StudyReview.dueOf({docs:cardDocs(s),subject:s,get})}));
    const totalDue=dues.reduce((a,x)=>a+x.d.due,0),totalNew=dues.reduce((a,x)=>a+x.d.new,0);
    const today_=document.createElement('section');today_.className='review-today';
    today_.innerHTML=`<div class="rt-head"><div><span class="eyebrow">TODAY · 今天先复习</span><h2>${totalDue?`到期 ${totalDue} 题`:totalNew?`可以开始：${totalNew} 题还没练过`:'今天没有要复习的题'}${totalDue&&totalNew?`<small>另有 ${totalNew} 题还没练过</small>`:''}</h2><p>先回想，再翻开参考要点，按不会／模糊／会了自评；忘了的很快再来，记住的间隔越拉越长。自评只排复习时间，不改变题目状态。</p></div></div><div class="rt-list">${dues.map(({s,d})=>`<button class="rt-item${d.due?' due':''}" data-drill="${s.id}" ${d.total?'':'disabled'}><b>${escape(s.name)}</b><span>${d.total?`${d.due?`到期 ${d.due}`:'无到期'} · 新 ${d.new}`:'还没有复习卡'}</span></button>`).join('')}</div>`;
    const bed=document.createElement('button');bed.className='rt-bed';bed.innerHTML='<b>☾ 睡前复习</b><span>全科混合 · 暗色 · 10～25 张 · 只回想不写字</span>';bed.onclick=()=>select('bed');
    today_.querySelector('.rt-head').append(bed);
    // Daytime algorithm: the data-structures plan says which template to hand-write today; night only recalls it.
    const ds=data.subjects.find(z=>z.id==='ds'),dsDoc=ds&&[...ds.summaries].sort((p,q)=>q.date.localeCompare(p.date)).find(z=>z.text);
    const algoPlan=dsDoc?nextAction(dsDoc.text).replace(/`/g,''):'';
    const algo=document.createElement('div');algo.className='rt-algo';
    algo.innerHTML=`<b>白天 · 算法手写</b><span>${algoPlan?escape(algoPlan):'按暴力解手册逐日表，在数据结构项目里手写一道并拍照批改。'}</span><small>晚上睡前复习每轮至少 2 张算法卡，只回想模板骨架。</small>`;
    today_.append(algo);
    today_.querySelectorAll('[data-drill]').forEach(b=>b.onclick=()=>select(b.dataset.drill,null,'drill'));
    // Progress lives in this browser only; a backup file carries it between phone and computer.
    const sync=document.createElement('div');sync.className='rt-sync';
    sync.innerHTML='<span>复习进度只存在这个浏览器。换手机／电脑前：</span><button type="button" class="text-button" id="backup-out">↓ 备份进度</button><label class="text-button" for="backup-in">↑ 从备份恢复</label><input type="file" id="backup-in" accept=".json,application/json" hidden>';
    today_.append(sync);
    sync.querySelector('#backup-out').onclick=()=>{const items={};try{for(let k=0;k<localStorage.length;k++){const key=localStorage.key(k);if(/^(study-drill-v1|bed-v1|study-v1):/.test(key))items[key]=localStorage.getItem(key);}}catch{}
      const blob=JSON.stringify({app:'wengu-progress',version:1,exportedAt:new Date().toISOString(),items},null,1);
      const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([blob],{type:'application/json'}));a.download=`温故复习进度-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notify(`已导出 ${Object.keys(items).length} 条进度`);};
    sync.querySelector('#backup-in').onchange=async e=>{const f=e.target.files[0];if(!f)return;
      try{const d=JSON.parse(await f.text());if(d.app!=='wengu-progress'||typeof d.items!=='object')throw Error();
        let n=0;for(const [key,val] of Object.entries(d.items)){if(!/^(study-drill-v1|bed-v1|study-v1):/.test(key)||typeof val!=='string')continue;
          const mine=get(key);
          // Keep whichever review happened later; drafts and settings only fill gaps.
          if(key.startsWith('study-drill-v1:')&&mine){try{const a=JSON.parse(mine),b=JSON.parse(val);if((Date.parse(a.reviewedAt)||0)>=(Date.parse(b.reviewedAt)||0))continue;}catch{}}
          else if(mine)continue;
          put(key,val);n++;}
        notify(`已合并 ${n} 条进度`);render();}catch{notify('不是有效的温故进度备份文件');}
      e.target.value='';};
    pane.append(today_);
    pane.append(examBoard());
    const head=document.createElement('div');head.className='all-head';
    head.innerHTML=`<div><b>每科：题目状态分布 · 最近14天记录 · 下次先做</b><span>状态由作答记录推出，只说明证据到了哪一步，不代表掌握。点一行进入该科题目追踪。</span></div><ol class="legend">${STATUSES.map((st,i)=>`<li><i class="sw s${i}"></i>${st}</li>`).join('')}</ol>`;
    pane.append(head);
    const span=[...Array(14)].map((_,i)=>{const d=new Date(Date.parse(today)-(13-i)*864e5);return d.toISOString().slice(0,10);});
    rows.forEach(({s,L})=>{
      const items=[...L.items.values()],n=items.length,count=STATUSES.map(st=>items.filter(it=>it.status===st).length);
      const days=new Set(s.records.map(d=>d.date)),reviews=new Set(s.summaries.map(d=>d.date));
      const last=[...days,...reviews].sort().pop();
      const latestReview=[...L.docs].reverse().find(d=>d.text);const next=latestReview?nextAction(latestReview.text).replace(/`/g,''):'';
      const row=document.createElement('button');row.className='all-row';row.dataset.subject=s.id;
      const bar=n?`<div class="stack" role="img" aria-label="${escape(s.name)}共${n}题：${STATUSES.map((st,i)=>count[i]?st+count[i]:'').filter(Boolean).join('，')}">${STATUSES.map((st,i)=>count[i]?`<span class="seg s${i}" style="flex:${count[i]}" data-tip="${st} ${count[i]}题"></span>`:'').join('')}</div><div class="stack-text">${n}题 · ${STATUSES.map((st,i)=>count[i]?`${st} ${count[i]}`:'').filter(Boolean).join(' · ')}</div>`:`<div class="stack empty-stack"></div><div class="stack-text muted">${s.summaries.length?'复盘还没有题目状态表':'还没有复盘'}</div>`;
      const strip=`<div class="strip" aria-label="最近14天记录">${span.map(d=>{const lv=reviews.has(d)?2:days.has(d)?1:0;return `<i class="day d${lv}" data-tip="${d.slice(5)} ${['无记录','有问答','有问答和复盘'][lv]}"></i>`;}).join('')}</div><div class="strip-cap"><span>${span[0].slice(5)}</span><span>近14天</span><span>${span[13].slice(5)}</span></div>`;
      row.innerHTML=`<div class="all-name"><b>${escape(s.name)}</b><span>${last?`最近记录 ${last.slice(5)} · ${daysBetween(last,today)===0?'今天':daysBetween(last,today)+'天前'}`:'暂无记录'}</span></div><div class="all-bar">${bar}</div><div class="all-days">${strip}</div><div class="all-next">${next?`<b>下次先做</b>${escape(next)}`:'<span class="muted">—</span>'}</div>`;
      row.onclick=()=>select(s.id,null,n?'ledger':'daily');pane.append(row);
    });
    const foot=document.createElement('p');foot.className='all-foot';foot.textContent=`数据：随站点发布的快照，加上本次已检查过GitHub的科目。14天按北京时间，截止 ${today}。`;pane.append(foot);
    currentText=['# 六科总览','',...rows.map(({s,L})=>{const items=[...L.items.values()];return `- ${s.name}：${items.length}题；`+STATUSES.map(st=>`${st}${items.filter(i=>i.status===st).length}`).join('，');})].join('\n')+'\n';
    $('#export').disabled=false;
  }
  async function render() {
    disposeDrill();disposeDrill=()=>{};
    const own=++generation;updateChrome();
    if(mode==='all'){$('#export').disabled=true;currentText='';try{await renderAll(own);}catch{if(own===generation)empty('暂时无法汇总','网络可能不可用或GitHub限流，请稍后重试。');}return;}currentText='';$('#export').disabled=true;const pane=$('#content');pane.innerHTML='<p>正在读取本科记录…</p>';
    try {
      if(tab==='handoff') {
        pane.innerHTML='<div class="protocol-intro">每科各写各的。规范问答 → 当日总结 → 闭卷自测 → 下次接续。</div>';
        const label=document.createElement('label');label.textContent='本科提示词（可手动选中复制）';label.htmlFor='prompt-text';pane.append(label);
        const field=document.createElement('textarea');field.id='prompt-text';field.className='search';field.rows=10;field.readOnly=true;field.value=prompt();pane.append(field);
        pane.append(renderMarkdown(data.protocol.text,data.protocol.path));currentText=prompt()+'\n\n'+data.protocol.text;
      } else if(tab==='drill') {
        const s=subject,docs=cardDocs(s);
        await Promise.all(docs.map(loadDoc));if(own!==generation)return;
        pane.replaceChildren();
        disposeDrill=StudyReview.mountDrill({docs,subject:s,container:pane,renderMarkdown,get,put,download})||(()=>{});
      } else if(tab==='ledger') {
        const L=await ledgerOf(subject);if(own!==generation)return;const {items,missing,problems,docs}=L;
        pane.innerHTML='<div class="doc-meta"><span class="badge">题目追踪</span><span>每题只显示最新状态 · 状态由逐次作答记录推出 · 只查证据是否齐全，不替你判卷</span></div>';
        const scale=document.createElement('ol');scale.className='status-scale';scale.innerHTML=STATUSES.map((s,i)=>`<li><span class="status s${i}">${s}</span><small>${STATUS_NOTE[s]}</small></li>`).join('');pane.append(scale);
        if(problems.length){const w=document.createElement('div');w.className='ledger-warning';w.innerHTML='<b>需要整理的记录</b>'+problems.map(x=>`<p>${escape(x)}</p>`).join('');pane.append(w);}
        if(!items.size){const p=document.createElement('p');p.className='ledger-empty';p.textContent=docs.length?'本科复盘还没有题目状态表。助手整理复盘时按模板补上；没有作答记录的题不会被升级。':'本科还没有复盘，也就没有可追踪的题目。';pane.append(p);}
        const rank=s=>s==='作答待核实'?-1:STATUSES.indexOf(s);
        [...items.values()].sort((a,b)=>rank(a.status)-rank(b.status)).forEach(it=>{
          const card=document.createElement('section');card.className='ledger-item';card.dataset.id=it.id;
          card.innerHTML=`<header><span class="status s${STATUSES.indexOf(it.status)}">${escape(it.status)}</span><span class="trail">${it.trail.map(([d,s])=>escape(d.slice(5)+' '+s)).join(' → ')}</span></header>`;
          const lastTry=[...it.attempts].reverse().find(counts);
          [['',it.title],['卡点 → 更正',it.fix],['下次验证',it.next],['最近作答',lastTry?`${lastTry.date} · ${lastTry.mode} · ${lastTry.result} · ${lastTry.basis}　${lastTry.content}`:''],['来源',it.source]].forEach(([label,value])=>{if(!value||value==='—')return;const row=document.createElement('div');row.className=label?'ledger-row':'ledger-title';if(label){const b=document.createElement('b');b.textContent=label;row.append(b);}row.append(renderMarkdown(value,it.path));card.append(row);});
          if(it.attempts.filter(counts).length>1){const more=document.createElement('details');more.className='attempts';more.innerHTML=`<summary>全部${it.attempts.filter(counts).length}次作答</summary>`+it.attempts.filter(counts).map(a=>`<p>${escape(`${a.date} · ${a.mode} · ${a.result} · ${a.basis}`)}</p>`).join('');card.append(more);}
          pane.append(card);
        });
        if(missing.length){const p=document.createElement('p');p.className='ledger-missing';p.textContent=`以下复盘没有题目状态表，未计入：${missing.join('、')}。`;pane.append(p);}
        currentText=['# '+subject.name+'｜题目追踪','','状态由作答记录推出；只检查证据是否齐全，不判断答案正确性。','',...[...items.values()].map(it=>`- ${it.id}｜${it.status}｜${it.trail.map(([d,s])=>d+' '+s).join(' → ')}｜下次：${it.next}`)].join('\n')+'\n';
      } else if(tab==='history') {
        pane.innerHTML='<div class="doc-meta"><span class="badge">历史交接</span><span>原回答可能有误，请连同边界说明阅读</span></div>';
        if(subject.diagrams?.length){
          const h=document.createElement('h2');h.textContent='本科图解';pane.append(h);
          const grid=document.createElement('div');grid.className='gallery';pane.append(grid);
          subject.diagrams.forEach(g=>{const fig=document.createElement('figure');fig.className='gallery-item';
            fig.append(renderMarkdown(`![${g.title.replace(/[\[\]]/g,'')}](${g.path.split('/').pop()})`,g.path));
            if(g.caption)fig.append(renderMarkdown(g.caption.text,g.caption.path));grid.append(fig);});
        }
        pane.append(renderMarkdown(subject.history.text,subject.history.path));
        const h=document.createElement('h2');h.textContent='按问题找原文';pane.append(h);
        const search=document.createElement('input');search.type='search';search.placeholder='搜索本科历史问题、关键词…';search.setAttribute('aria-label','搜索本科历史问题');search.className='search';pane.append(search);
        const list=document.createElement('div');pane.append(list);
        function filter(){list.innerHTML='';const docs=subject.archive.filter(d=>(d.title+d.text).toLowerCase().includes(search.value.trim().toLowerCase()));if(!docs.length){list.textContent='没有匹配的历史原文，不代表没有学习过。';return;}docs.forEach(d=>{const box=document.createElement('details');box.className='archive';const sum=document.createElement('summary');sum.textContent=d.title;box.append(sum);box.ontoggle=()=>{if(box.open&&!box.querySelector('article'))box.append(renderMarkdown(d.text,d.path));};list.append(box);});}search.oninput=filter;filter();currentText=subject.history.text;
      } else {
        const doc=tab==='daily'?summaryDoc():recordDoc();
        if(!doc){empty(tab==='daily'?'这一天，还没有本科复盘':'这一天，还没有本科问答',tab==='daily'?'新助手可以根据已保存的问答整理。没有学习证据，就保留空白；不自动补成“已完成”。':'已上传的其他科记录不会放进来。请选择有记录的日期，或让本科助手按约定追加。');}
        else {await loadDoc(doc);if(own!==generation)return;pane.innerHTML=`<div class="doc-meta"><span class="badge">${tab==='daily'?'每日复盘':'当天问答'}</span><span>${escape(date)} · ${escape(subject.name)}</span><a href="${RAW+encodePath(doc.path)}" target="_blank" rel="noopener">原始文件 ↗</a></div>`;pane.append(renderMarkdown(doc.text,doc.path));currentText=doc.text;}
        const days=[...new Set([...subject.records,...subject.summaries].map(d=>d.date))].sort().reverse();
        if(days.length){const h=document.createElement('h3');h.textContent='已保存的日期';pane.append(h);const list=document.createElement('div');list.className='record-list';days.forEach(day=>{const b=document.createElement('button');b.className='record-entry';b.textContent=day+(subject.summaries.some(d=>d.date===day)?' · 有复盘':' · 有问答');b.onclick=()=>select(subject.id,day,tab);list.append(b);});pane.append(list);}
      }
      updateChrome();$('#export').disabled=!currentText;
    } catch {if(own!==generation)return;empty('暂时无法读取这个文件','网络可能不可用或GitHub限流。已发布快照与GitHub原文仍可查看，请稍后重试。');}
  }
  function select(id,day,nextTab){if(id==='bed'){openBed();return;}if(id==='all'){mode='all';subject=subject||data.subjects[4];history.replaceState(null,'','#all');render();return;}mode='subject';subject=data.subjects.find(s=>s.id===id)||data.subjects[4];date=day||subject.records[0]?.date||data.latestDate||localDate();tab=nextTab||'daily';if(!/^\d{4}-\d{2}-\d{2}$/.test(date))date=localDate();history.replaceState(null,'',`#${subject.id}/${date}/${tab}`);render();syncSubject(false);}
  async function syncSubject(force) {
    const s=subject;if(synced.has(s.id)&&!force)return;
    synced.set(s.id,'正在检查GitHub新记录…');updateChrome();
    try {
      const results=await Promise.all(['问答记录','每日复盘'].map(async area=>{
        const base=`${area}/${s.name}`;
        const r=await fetch(API+encodePath(base)+'?ref=main',{signal:AbortSignal.timeout(10000),credentials:'omit'});
        if(r.status===404)return [];if(!r.ok)throw Error();const values=await r.json();if(!Array.isArray(values))throw Error();
        return values.filter(d=>d.type==='file'&&/^\d{4}-\d{2}-\d{2}\.md$/.test(d.name)).map(d=>({path:base+'/'+d.name,date:d.name.slice(0,10),title:d.name,gitSha:d.sha})).sort((a,b)=>b.date.localeCompare(a.date));
      }));
      // A local preview may contain not-yet-published days; do not erase its evidence on 404.
      // Same blob sha → keep the snapshot text; changed or new on GitHub → use GitHub's version (fetched from Raw on demand).
      // A file missing on GitHub is kept, so a local preview does not lose unpublished evidence.
      const merge=(old,remote)=>{const m=new Map(old.map(d=>[d.date,d]));remote.forEach(r=>{const o=m.get(r.date);if(!o||o.gitSha!==r.gitSha)m.set(r.date,r);});return [...m.values()].sort((a,b)=>b.date.localeCompare(a.date));};
      s.records=merge(s.records,results[0]);s.summaries=merge(s.summaries,results[1]);
      const fresh=[...s.records,...s.summaries].filter(d=>d.text===undefined).length;synced.set(s.id,fresh?`已检查GitHub · ${fresh}个文件比快照新`:'已检查GitHub · 与发布快照一致');
      if(s===subject){await render();}
    } catch {synced.set(s.id,'GitHub未连通／限流 · 使用发布快照');if(s===subject)$('#sync-state').textContent=synced.get(s.id);}
  }
  async function copyPrompt() {try {await navigator.clipboard.writeText(prompt());notify('本科每日提示词已复制');}catch {tab='handoff';await render();const field=$('#prompt-text');field.focus();field.select();notify('无法自动复制，已选中提示词，请手动复制。');}}
  document.querySelectorAll('[data-tab]').forEach(b=>{b.onclick=()=>select(subject.id,date,b.dataset.tab);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const buttons=[...document.querySelectorAll('[data-tab]')],i=buttons.indexOf(b),n=buttons[(i+(e.key==='ArrowRight'?1:buttons.length-1))%buttons.length];n.click();n.focus();};});
  $('#date').onchange=e=>{if(e.target.value)select(subject.id,e.target.value,tab);};
  $('#refresh').onclick=()=>syncSubject(true);$('#all-link').onclick=e=>{e.preventDefault();select('all');};$('#bed-link').onclick=e=>{e.preventDefault();select('bed');};$('#copy-prompt').onclick=copyPrompt;
  $('#reviewed').onclick=()=>{put(key('reviewed'),get(key('reviewed'))==='yes'?'no':'yes');updateChrome();};
  $('#draft').oninput=e=>put(key('draft'),e.target.value);
  $('#clear-draft').onclick=()=>{if(!get(key('draft')))return;if(confirm('清空本日期、本科目的本地草稿？建议先导出。')){put(key('draft'),'');$('#draft').value='';}};
  $('#export-draft').onclick=()=>download(`# ${date} ${subject.name}｜个人复盘草稿\n\n${get(key('draft'))}\n\n仅个人草稿，公开上传前需审核。\n`,`${date}-${subject.name}-个人草稿.md`);
  $('#export').onclick=()=>{if(currentText)download(currentText,`${date}-${subject.name}-${{daily:'每日复盘',records:'当天问答',ledger:'题目追踪',history:'过往记录',handoff:'交给助手'}[tab]}.md`);};
  // One hover/focus tooltip for chart marks (bar segments, day cells).
  const tip=document.createElement('div');tip.className='chart-tip';tip.hidden=true;document.body.append(tip);
  document.addEventListener('pointerover',e=>{const m=e.target.closest('[data-tip]');if(!m){tip.hidden=true;return;}tip.textContent=m.dataset.tip;tip.hidden=false;const r=m.getBoundingClientRect();tip.style.left=Math.min(innerWidth-tip.offsetWidth-8,Math.max(8,r.left+r.width/2-tip.offsetWidth/2))+'px';tip.style.top=(r.top-tip.offsetHeight-8)+'px';});
  // Bedtime review opens over the overview; closing it returns there.
  let bedOpen=false;
  async function openBed(){
    if(bedOpen)return;bedOpen=true;mode='all';subject=subject||data.subjects[4];history.replaceState(null,'','#bed');
    await Promise.all(data.subjects.flatMap(s=>s.summaries.map(loadDoc))).catch(()=>{});
    render();
    StudyBedtime.mount({subjects:data.subjects,renderMarkdown,get,put,today,nextOf:s=>{const d=[...s.summaries].sort((a,b)=>b.date.localeCompare(a.date)).find(x=>x.text);return d?nextAction(d.text).replace(/`/g,''):'';},onExit:()=>{bedOpen=false;history.replaceState(null,'','#all');render();}});
  }
  function route(){const [id,d,t]=location.hash.slice(1).split('/');if(id==='bed'){select('bed');return;}if(!id||id==='all'){select('all');return;}select(id,d,TABS.includes(t)?t:'daily');}
  window.addEventListener('hashchange',()=>{if(data)route();});
  // Offline copy for bedtime use and slow networks; the page works the same without it.
  if('serviceWorker' in navigator&&(location.protocol==='https:'||['127.0.0.1','localhost'].includes(location.hostname)))navigator.serviceWorker.register('sw.js').catch(()=>{});
  fetch('assets/data.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{data=d;route();}).catch(()=>{$('#subject-title').textContent='学习档案暂时未加载';$('#content').textContent='请刷新页面，或通过左侧公开资料库直接读取Markdown。';});
})();
