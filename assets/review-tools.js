/* Local recall practice; never grades answers or changes the evidence ledger. */
(() => {
  'use strict';
  const create = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const hash = text => {
    let n = 2166136261;
    for (const c of text) { n ^= c.codePointAt(0); n = Math.imul(n, 16777619); }
    return (n >>> 0).toString(36);
  };
  function cardsOf(docs) {
    const cards = [];
    for (const doc of docs) {
      const pattern = /^### 自测：([^\n]+)\n([\s\S]*?)(?=^#{1,3} |$(?![\s\S]))/gm;
      for (const match of (doc.text || '').matchAll(pattern)) {
        const question = match[1].trim(), body = match[2].trim();
        // Only text before the explicit answer marker is visible before recall.
        // Legacy cards without the marker keep their whole body hidden.
        const marker = /^\*\*参考要点\*\*[：:]/m.exec(body);
        const context = marker ? body.slice(0,marker.index).trim() : '';
        const answer = marker ? body.slice(marker.index).trim() : body;
        if (!answer) continue;
        cards.push({id:hash(doc.path+'\n'+question+'\n'+body),question,context,answer,path:doc.path,date:doc.date});
      }
    }
    return cards;
  }
  function svgData(source) {
    if (source.length > 250000 || /<!DOCTYPE|<!ENTITY/i.test(source)) throw Error('图过大或包含不支持的声明');
    const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') throw Error('SVG格式不完整');
    const safe = DOMPurify.sanitize(source, {USE_PROFILES:{svg:true,svgFilters:false},RETURN_DOM_FRAGMENT:true});
    const svg = safe.querySelector('svg');
    if (!svg) throw Error('没有有效SVG');
    const tags = new Set(['svg','g','rect','circle','ellipse','line','polyline','polygon','path','text','tspan','defs','marker','linearGradient','radialGradient','stop','title','desc']);
    const attrs = new Set(['xmlns','viewBox','width','height','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','d','points','transform','fill','stroke','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','fill-opacity','stroke-opacity','font-size','font-family','font-weight','text-anchor','dominant-baseline','dx','dy','id','marker-start','marker-mid','marker-end','markerWidth','markerHeight','refX','refY','orient','markerUnits','offset','stop-color','stop-opacity','gradientUnits','gradientTransform']);
    for (const node of [svg,...svg.querySelectorAll('*')]) {
      if (!tags.has(node.localName)) { node.remove(); continue; }
      for (const attr of [...node.attributes]) {
        // No scripts, foreignObject, links, style/CSS, images, animations or external resources.
        if (!attrs.has(attr.name) || /(?:javascript|data|https?|file):|@import|expression\s*\(/i.test(attr.value) || (/url\s*\(/i.test(attr.value) && !/^url\(#[\w-]+\)$/.test(attr.value))) node.removeAttribute(attr.name);
      }
    }
    svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
    if (!svg.hasAttribute('viewBox')) {
      const w = Number(svg.getAttribute('width')), h = Number(svg.getAttribute('height'));
      if (w > 0 && h > 0) svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    }
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));
  }
  let lightbox;
  function zoom(src, label) {
    if (!lightbox) {
      lightbox = create('dialog','image-lightbox');lightbox.setAttribute('aria-label','图解放大');
      const close = create('button','secondary','关闭 · Esc'); close.type='button';close.onclick=()=>lightbox.close();
      lightbox.append(close,create('p','lightbox-caption'),create('div','lightbox-scroll'));
      lightbox.addEventListener('click',e=>{if(e.target===lightbox)lightbox.close();});document.body.append(lightbox);
    }
    lightbox.querySelector('.lightbox-caption').textContent=label;
    const picture=create('img');picture.src=src;picture.alt=label;
    lightbox.querySelector('.lightbox-scroll').replaceChildren(picture);lightbox.showModal();
  }
  function enhanceFigures(el) {
    el.querySelectorAll('pre > code.language-svg').forEach(code=>{
      const figure=create('figure','study-figure');
      const caption=create('figcaption','','图解 · 点击放大（图中结论仍需按来源核实）');
      try {
        const img=create('img');img.src=svgData(code.textContent);img.alt='问答中的SVG图解';figure.append(img,caption);code.parentElement.replaceWith(figure);
      } catch (error) {
        code.parentElement.before(create('p','figure-warning',`图解暂不能显示：${error.message}。原始代码保留在下方。`));
      }
    });
    el.querySelectorAll('pre > code').forEach(code=>{
      if (!/language-(html|jsx|tsx|react)\b/.test(code.className)) return;
      const box=create('details','source-only');box.append(create('summary','','查看HTML／React源码（不执行）'));
      const pre=code.parentElement;pre.before(box);box.append(pre);
    });
    el.querySelectorAll('img').forEach(img=>{
      if (img.closest('a,button')) return;
      const button=create('button','figure-zoom');button.type='button';button.setAttribute('aria-label','放大图解：'+(img.alt||'图片'));
      img.before(button);button.append(img);button.onclick=()=>zoom(img.src,img.alt||'图解');
    });
  }
  function mountDrill({docs,subject,container,renderMarkdown,get,put,download}) {
    const cards=cardsOf(docs),prefix=`study-drill-v1:${subject.id}:`;
    function read(card) {try {const v=JSON.parse(get(prefix+card.id)||'{}');return v&&typeof v==='object'?v:{};}catch{return {};}}
    function save(card,patch) {put(prefix+card.id,JSON.stringify({...read(card),...patch}));}
    const heading=create('div','drill-intro');heading.append(create('h2','','到期再见，越记越牢'),create('p','','先复习到期题，再学新题。先回想、再看参考；记住的逐步拉长间隔，忘记的更快回来。自评不改变题目证据状态。'));container.append(heading);
    const stats=create('div','spacing-status');stats.setAttribute('role','status');container.append(stats);
    const timeLabel=timestamp=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(timestamp));
    function updateStats() {const s=StudySpacing.summary(cards,read);stats.textContent=`到期 ${s.due} · 新题 ${s.new} · 等待 ${s.waiting}`+(s.next!==null?`｜下一次 ${timeLabel(s.next)}（北京时间）`:'');}
    const settings=create('details','drill-settings');settings.append(create('summary','','间隔规则 · 导出 · 保存说明'));container.append(settings);
    const rule=create('div','spacing-rules');rule.append(create('b','','复习间隔怎么安排？'),create('p','','不会：10分钟后，重新开始；模糊：1天后，回退一级；会了：1 → 3 → 7 → 14 → 30 → 60天。提前练习点“会了”保留原到期时间。规则是学习建议，不是墨墨内部算法，也不是掌握证明。'));
    settings.append(rule);
    const toolbar=create('div','drill-toolbar');
    const exportButton=create('button','secondary','导出本科自测记录');exportButton.type='button';
    exportButton.onclick=()=>{
      const text=['# '+subject.name+'｜本机闭卷自测记录','','仅自评／个人草稿，不是已核实作答证据。',...cards.map(c=>{
        const s=read(c);return `\n## ${c.question}\n\n来源：${c.path}\n\n${c.context||'题面见问题标题。'}\n\n我的回想：${s.note||'未填写'}\n\n自评：${s.rating||'未评'}${s.reviewedAt?' · '+timeLabel(Date.parse(s.reviewedAt))+'（北京时间）':''}\n\n下次复习：${Number.isFinite(s.due)?timeLabel(s.due)+'（北京时间）':'尚未安排'}\n`;
      })].join('\n');download(text,subject.name+'-闭卷自测记录.md');
    };
    exportButton.disabled=!cards.length;toolbar.append(exportButton);settings.append(toolbar);
    settings.append(create('small','','安排和回想只存当前浏览器，不跨设备；关闭网页不推送通知。重新打开会列出到期题。内容修订后按新题重新测；旧记录仍留在浏览器，但此处只导出当前版本。'));
    const stage=create('div','drill-stage');container.append(stage);
    updateStats();
    if (!cards.length) {stage.append(create('p','empty','本科还没有复习卡：复盘里还没有自测题。说“总结今天”让本科助手根据真实问答写，不自动编造。'));return;}
    let queue=[],index=0;
    function start(all=false) {
      queue=StudySpacing.queue(cards,read,Date.now(),all);index=0;show();
    }
    function show() {
      stage.replaceChildren();
      updateStats();
      if(index>=queue.length) {
        stage.append(create('h3','',queue.length?'本轮到这里':'现在没有到期自测'),create('p','','不用反复刷熟悉题。留点间隔再回忆；本页保持打开时，到期题会自动出现，也可以下次打开再学。'));
        const again=create('button','primary','查看到期题');again.type='button';again.onclick=()=>start();
        const all=create('button','secondary','不等到期，练全部');all.type='button';all.onclick=()=>start(true);stage.append(again,all);return;
      }
      const card=queue[index],state=read(card);
      stage.append(create('div','eyebrow',`${index+1} / ${queue.length} · 来源 ${card.date} · ${subject.name}`));
      const question=create('div','drill-question');question.append(renderMarkdown('### '+card.question,card.path));stage.append(question);
      if(card.context) {const context=create('div','drill-context');context.append(renderMarkdown(card.context,card.path));stage.append(context);}
      const label=create('label','','我的回想（可选，也可以口述）');label.htmlFor='recall-answer';
      const input=create('textarea','recall-answer');input.id='recall-answer';input.rows=4;input.placeholder='先写自己的解释、公式条件或步骤，再看参考要点。';input.value=state.note||'';input.oninput=()=>save(card,{note:input.value});stage.append(label,input);
      const reveal=create('button','primary','我已回想，查看参考要点');reveal.type='button';
      const answer=create('div','drill-answer');answer.hidden=true;answer.append(renderMarkdown(card.answer,card.path));
      answer.append(renderMarkdown(`[回看来源复盘](${card.path.split('/').map(encodeURIComponent).join('/')})`,'index.html'));
      const rates=create('div','drill-rate');rates.hidden=true;rates.append(create('span','','与参考要点对照后：'));
      ['不会','模糊','会了'].forEach(rating=>{
        const button=create('button','secondary rate',rating);button.type='button';button.onclick=()=>{
          save(card,StudySpacing.schedule(read(card),rating));index++;show();
        };rates.append(button);
        const preview=StudySpacing.schedule(state,rating);
        button.append(create('small','',preview.early?'保留原到期时间':rating==='不会'?'10分钟后':rating==='模糊'?'1天后':`${Math.round((preview.due-Date.now())/86400000)}天后`));
      });
      reveal.onclick=()=>{answer.hidden=false;rates.hidden=false;reveal.hidden=true;};stage.append(reveal,answer,rates);
    }
    start();
    // Only the currently mounted page gets a timer. Never interrupt an answer in progress.
    const tick=()=>{if(!stage.isConnected)return;updateStats();if(index>=queue.length&&StudySpacing.queue(cards,read).length)start();};
    const timer=setInterval(tick,15000);document.addEventListener('visibilitychange',tick);
    return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);};
  }
  // Due/new counts for one subject, read from the same browser-local schedule the drill writes.
  function dueOf({docs,subject,get}) {
    const prefix=`study-drill-v1:${subject.id}:`,cards=cardsOf(docs);
    const read=c=>{try{const v=JSON.parse(get(prefix+c.id)||'{}');return v&&typeof v==='object'?v:{};}catch{return {};}};
    return {...StudySpacing.summary(cards,read),total:cards.length};
  }
  window.StudyReview={cardsOf,dueOf,svgData,enhanceFigures,mountDrill};
})();
