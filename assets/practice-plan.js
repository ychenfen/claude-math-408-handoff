/* Read-only priorities from recorded exams and explicit checks. No mastery inference. */
(function(root) {
  'use strict';
  const tidy = s => String(s || '').replace(/[`\s]/g, '');
  const hash = s => {let n=2166136261;for(const c of s){n^=c.codePointAt(0);n=Math.imul(n,16777619);}return (n>>>0).toString(36);};
  function gapsOf(doc, subject) {
    const out=[];
    for(const sec of (doc.text || '').split(/^(?=## )/m)) {
      const head=sec.match(/^## (.+)$/m);if(!head)continue;
      const fields={};
      for(const m of sec.matchAll(/^\*\*(题|漏洞编号|漏洞|补法|检验结果|检验)\*\*([^：:\n]*)[：:]([\s\S]*?)(?=\n\s*\n|\n\*\*|(?![\s\S]))/gm))
        if(!fields[m[1]])fields[m[1]]={note:m[2].trim(),text:m[3].trim()};
      if(!fields['漏洞']&&!fields['检验'])continue;
      const title=head[1].replace(/^\d{1,2}:\d{2}\s*/,'').replace(/`/g,'').trim();
      const time=head[1].match(/^\d{1,2}:\d{2}/)?.[0] || '';
      const check=fields['检验']?.text || '', result=fields['检验结果']?.text || '';
      const reuse=check.match(/仍用\s*(\d{1,2}:\d{2}).*?迁移题\s*[（(]\s*([a-z])\s*[)）]/);
      const parts=[...check.matchAll(/[（(]([a-z])[)）]/g)];
      // Only split an explicit (a), (b), ... question list, never a parenthesis inside a question.
      const split=!reuse&&parts.length>1&&parts[0].index===0&&parts.every((m,i)=>m[1]===String.fromCharCode(97+i));
      const checks=split?parts.map((m,i)=>({part:m[1],text:check.slice(m.index,parts[i+1]?.index).trim()})):[{part:'',text:check}];
      for(const item of checks) {
        const anchor=time?`${doc.path}#${time}/${item.part}`:'';
        const explicit=fields['漏洞编号']?.text;
        // Same question number is insufficient: keep different checks separate.
        const identity=explicit?`id:${subject.id}:${tidy(explicit)}:${item.part}`:
          item.text?`check:${subject.id}:${title.match(/408-\d{4}-\d+(?:\(\d+\))?/)?.[0]||''}:${tidy(item.text)}:${/同上|同一|上题|原题/.test(item.text)?tidy(fields['题']?.text):''}`:`section:${doc.path}:${head[1]}`;
        out.push({identity,anchor,reuse:reuse?`${doc.path}#${reuse[1]}/${reuse[2]}`:'',subject,
          title:title+(split?` · 检验 ${item.part}`:''),date:doc.date,time,path:doc.path,
          gap:fields['漏洞']?.text || '',fix:fields['补法']?.text || '',check:item.text,
          checkNote:fields['检验']?.note || '',question:fields['题']?.text||'',questionNote:fields['题']?.note||'',result});
      }
    }
    return out;
  }
  function groupsOf(subjects) {
    const units=subjects.flatMap(s=>s.records.flatMap(d=>gapsOf(d,s))).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    const anchors=new Map(units.filter(u=>u.anchor).map(u=>[u.anchor,u]));
    const groups=new Map();
    for(const u of units) {
      const original=u.reuse&&anchors.get(u.reuse);
      const identity=original?.identity || u.identity;
      const g=groups.get(identity)||{id:hash(identity),subject:u.subject,members:[],result:'',status:'待检验'};
      g.members.push(u);
      // An ordinary follow-up explanation does not erase a recorded check result.
      if(u.result){g.result=u.result;g.status=/^未通过/.test(u.result)?'未通过':/^通过/.test(u.result)?'已通过':'待检验';}
      Object.assign(g,{title:u.title,date:u.date,path:u.path,gap:u.gap||g.gap,fix:u.fix||g.fix,
        check:original?.check||u.check||g.check,checkNote:original?.checkNote||u.checkNote,
        question:original?.question||u.question||g.question,questionNote:original?.questionNote||u.questionNote||g.questionNote});
      groups.set(identity,g);
    }
    return [...groups.values()];
  }
  function priorities(groups, exams, limit=3) {
    const latest=[...exams].filter(e=>e.score.subject==='408').sort((a,b)=>b.date.localeCompare(a.date))[0];
    const candidates=groups.filter(g=>g.status!=='已通过'&&g.check).map(g=>{
      const titles=g.members.map(m=>m.title).join(' ');
      const items=(latest?.items||[]).filter(it=>it.subject===g.subject.name &&
        new RegExp(`408-${latest.score.paper.match(/\d{4}/)?.[0]}-${it.id}(?![0-9])`).test(titles));
      const loss=items.reduce((n,it)=>n+it.full-it.got,0);
      const reasons=[];
      if(loss)reasons.push(`${latest.date.slice(5)} 整卷该题丢 ${loss} 分（按现有评分记录）`);
      if(g.status==='未通过')reasons.push('最近一次检验未通过');
      if(g.members.length>1)reasons.push(`同一检验有 ${g.members.length} 次相关记录`);
      reasons.push('仍缺闭卷检验结果');
      return {...g,reasons,rank:(g.status==='未通过'?1000:0)+loss*10+Math.min(g.members.length-1,3)*3};
    }).sort((a,b)=>b.rank-a.rank||b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
    // First cover different subjects, then fill any remaining slots.
    const picked=[],seen=new Set();
    for(const g of candidates)if(!seen.has(g.subject.id)&&picked.length<limit){picked.push(g);seen.add(g.subject.id);}
    for(const g of candidates)if(!picked.includes(g)&&picked.length<limit)picked.push(g);
    return picked;
  }
  function submission({subject,question,context,note,path,today,revealed}) {
    return `请核对【${subject.name}】这道闭卷检验，日期：${today}（北京时间）。\n\n题目：${question}\n\n${context||'题面细节请从来源核实，缺条件时不要猜。'}\n\n我的作答：\n${note||'（我将补充作答文字或照片）'}\n\n作答情况：${revealed?'网页参考要点已经展开；是否先完成作答、是否使用提示，由我补充确认。':'网页参考要点未展开；是否独立、是否在别处看过答案或提示，由我补充确认。'}\n\n来源：https://github.com/ychenfen/claude-math-408-handoff/blob/main/${path.split('/').map(encodeURIComponent).join('/')}\n\n请逐步核对我的作答，指出具体错误、核对依据及仍未核实的地方。有答案册或原题才能据此核对，没有就明确缺失。先给出核对结果；按仓库规范记录本科当天问答，区分独立作答与看答案后作答，不因自评升级题目状态。公开上传仍需我的授权。`;
  }
  function contextOf(group) {
    return /同上|同一|上题|原题/.test(group.check)?
      (group.question?`**原题条件${group.questionNote}（供迁移题参照，以后面的改动为准）**：${group.question}\n\n**本次迁移检验**：${group.check}`:
        `**题面缺少所引用的原题条件，请先补齐后作答。**\n\n${group.check}`):group.check;
  }
  const api={gapsOf,groupsOf,priorities,submission,contextOf};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StudyPlan=api;
})(globalThis);
