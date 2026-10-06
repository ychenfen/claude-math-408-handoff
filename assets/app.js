/* Static public reader. No credentials, write API or automatic chat ingestion. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const RAW = 'https://raw.githubusercontent.com/ychenfen/claude-math-408-handoff/main/';
  const API = 'https://api.github.com/repos/ychenfen/claude-math-408-handoff/contents/';
  let data, subject, date, tab = 'daily', generation = 0, currentText = '', storageOK = true;
  const memo = {}, synced = new Map();
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
    el.innerHTML=DOMPurify.sanitize(marked.parse(text),{FORBID_TAGS:['style','iframe','form','input'],FORBID_ATTR:['style']});
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
      let next=h.nextSibling;
      while(next && !(next.nodeType===1 && /^H[123]$/.test(next.tagName))){const move=next;next=next.nextSibling;answer.append(move);}
      box.append(answer);h.replaceWith(box);
    });
    if(window.renderMathInElement)renderMathInElement(el,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false},{left:'\\(',right:'\\)',display:false}],throwOnError:false,trust:false});
    return el;
  }
  function prompt() {
    return `你负责【${subject.name}】。请先读 https://github.com/ychenfen/claude-math-408-handoff 的 AGENTS.md、每日复盘/使用说明.md 和该科历史交接。\n\n请按北京时间 ${date}，读取 问答记录/${subject.name}/${date}.md 的真实记录，总结今天实际涉及的内容、知识点及适用条件、我的具体卡点与纠正、3～5个闭卷自测和最多3项下一步动作。引用原问答；没有作答、原图或教材就标未核实，不把计划当完成、不混入其他科目。\n\n按 每日复盘/模板.md 保存到 每日复盘/${subject.name}/${date}.md。后续每次答疑追加到该科当天问答。请先给我核对公开内容；只有我授权上传时再提交GitHub，不覆盖其他助手改动。`;
  }
  function summaryDoc() { return subject.summaries.find(d=>d.date===date); }
  function recordDoc() { return subject.records.find(d=>d.date===date); }
  function download(text,name) {const a=document.createElement('a');const u=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  function empty(title,body) {
    $('#content').innerHTML=`<div class="empty"><div class="empty-icon">○</div><h2>${escape(title)}</h2><p>${escape(body)}</p><button class="secondary" id="empty-copy">把今天交给本科助手 ↗</button></div>`;
    $('#empty-copy').onclick=copyPrompt;
  }
  function updateChrome() {
    document.title=`${subject.name} · 温故学习工作台`;
    $('#subject-title').textContent=subject.name;$('#tagline').textContent=subject.tag;$('#date').value=date;
    $('#eyebrow').textContent=`SUBJECT ${String(data.subjects.indexOf(subject)+1).padStart(2,'0')} / 六科独立记录`;
    $('#subjects').innerHTML=data.subjects.map((s,i)=>`<button class="subject" data-subject="${s.id}" aria-current="${s===subject}"><span class="num">0${i+1}</span>${escape(s.name)}${s.records.length?'<i class="dot"></i>':''}</button>`).join('');
    $('#subjects').querySelectorAll('button').forEach(b=>b.onclick=()=>select(b.dataset.subject,null,'daily'));
    const available=Boolean(summaryDoc());
    $('#overview').innerHTML=`<div class="metric"><div class="mark">↗</div><div><b>${available?'这一天，已有复盘':recordDoc()?'已有问答 · 等待整理':'这一天，尚无记录'}</b><span>${available?'先闭卷回想，再展开参考要点':recordDoc()?'记录不是完成，先确认再归纳':'留白真实，比补写可靠'}</span></div></div><div class="metric"><strong>${subject.records.length}</strong><div><b>天问答</b><span>本科独立保存</span></div></div><div class="metric"><strong>${subject.archive.length}</strong><div><b>历史主题</b><span>不是掌握数量</span></div></div>`;
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
  async function render() {
    const own=++generation;updateChrome();currentText='';$('#export').disabled=true;const pane=$('#content');pane.innerHTML='<p>正在读取本科记录…</p>';
    try {
      if(tab==='handoff') {
        pane.innerHTML='<div class="protocol-intro">每科各写各的。规范问答 → 当日总结 → 闭卷自测 → 下次接续。</div>';
        const label=document.createElement('label');label.textContent='本科提示词（可手动选中复制）';label.htmlFor='prompt-text';pane.append(label);
        const field=document.createElement('textarea');field.id='prompt-text';field.className='search';field.rows=10;field.readOnly=true;field.value=prompt();pane.append(field);
        pane.append(renderMarkdown(data.protocol.text,data.protocol.path));currentText=prompt()+'\n\n'+data.protocol.text;
      } else if(tab==='history') {
        pane.innerHTML='<div class="doc-meta"><span class="badge">历史交接</span><span>原回答可能有误，请连同边界说明阅读</span></div>';
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
      $('#export').disabled=!currentText;
    } catch {if(own!==generation)return;empty('暂时无法读取这个文件','网络可能不可用或GitHub限流。已发布快照与GitHub原文仍可查看，请稍后重试。');}
  }
  function select(id,day,nextTab){subject=data.subjects.find(s=>s.id===id)||data.subjects[4];date=day||subject.records[0]?.date||data.latestDate||localDate();tab=nextTab||'daily';if(!/^\d{4}-\d{2}-\d{2}$/.test(date))date=localDate();history.replaceState(null,'',`#${subject.id}/${date}/${tab}`);render();syncSubject(false);}
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
      const merge=(old,remote)=>[...new Map([...old,...remote].map(d=>[d.date,d])).values()].sort((a,b)=>b.date.localeCompare(a.date));
      s.records=merge(s.records,results[0]);s.summaries=merge(s.summaries,results[1]);
      synced.set(s.id,'已检查GitHub · 合并发布快照');
      if(s===subject){await render();}
    } catch {synced.set(s.id,'GitHub未连通／限流 · 使用发布快照');if(s===subject)$('#sync-state').textContent=synced.get(s.id);}
  }
  async function copyPrompt() {try {await navigator.clipboard.writeText(prompt());notify('本科每日提示词已复制');}catch {tab='handoff';await render();const field=$('#prompt-text');field.focus();field.select();notify('无法自动复制，已选中提示词，请手动复制。');}}
  document.querySelectorAll('[data-tab]').forEach(b=>{b.onclick=()=>select(subject.id,date,b.dataset.tab);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const buttons=[...document.querySelectorAll('[data-tab]')],i=buttons.indexOf(b),n=buttons[(i+(e.key==='ArrowRight'?1:3))%4];n.click();n.focus();};});
  $('#date').onchange=e=>{if(e.target.value)select(subject.id,e.target.value,tab);};
  $('#refresh').onclick=()=>syncSubject(true);$('#copy-prompt').onclick=copyPrompt;
  $('#reviewed').onclick=()=>{put(key('reviewed'),get(key('reviewed'))==='yes'?'no':'yes');updateChrome();};
  $('#draft').oninput=e=>put(key('draft'),e.target.value);
  $('#clear-draft').onclick=()=>{if(!get(key('draft')))return;if(confirm('清空本日期、本科目的本地草稿？建议先导出。')){put(key('draft'),'');$('#draft').value='';}};
  $('#export-draft').onclick=()=>download(`# ${date} ${subject.name}｜个人复盘草稿\n\n${get(key('draft'))}\n\n仅个人草稿，公开上传前需审核。\n`,`${date}-${subject.name}-个人草稿.md`);
  $('#export').onclick=()=>{if(currentText)download(currentText,`${date}-${subject.name}-${tab}.md`);};
  function route(){const [id,d,t]=location.hash.slice(1).split('/');select(id,d,['daily','records','history','handoff'].includes(t)?t:'daily');}
  window.addEventListener('hashchange',()=>{if(data)route();});
  fetch('assets/data.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{data=d;route();}).catch(()=>{$('#subject-title').textContent='学习档案暂时未加载';$('#content').textContent='请刷新页面，或通过左侧公开资料库直接读取Markdown。';});
})();
