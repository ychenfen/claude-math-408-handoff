/* Transparent interval ladder, not Momo's proprietary algorithm or a correctness grader. */
(function(root) {
  'use strict';
  const DAY=86400000,MINUTE=60000,INTERVAL_DAYS=Object.freeze([1,3,7,14,30,60]);
  const levelOf=s=>Number.isInteger(s.level)&&s.level>=0&&s.level<=INTERVAL_DAYS.length?s.level:(s.rating==='会了'?1:0);
  const hasSchedule=s=>Number.isFinite(s.due)&&s.due>0;
  function schedule(previous,rating,now=Date.now()) {
    if(!['不会','模糊','会了'].includes(rating))throw Error('Unknown recall rating');
    if(!Number.isFinite(now))throw Error('Invalid review time');
    const s=previous||{},level=levelOf(s);
    // An early successful extra practice must not compress a month of spaced reviews into a day.
    if(rating==='会了'&&hasSchedule(s)&&s.due>now)
      return {rating,level,due:s.due,reviewedAt:new Date(now).toISOString(),scheduleVersion:2,early:true};
    const interval=rating==='不会'?10*MINUTE:rating==='模糊'?DAY:INTERVAL_DAYS[Math.min(level,INTERVAL_DAYS.length-1)]*DAY;
    return {rating,level:rating==='不会'?0:rating==='模糊'?Math.max(0,level-1):Math.min(level+1,INTERVAL_DAYS.length),due:now+interval,reviewedAt:new Date(now).toISOString(),scheduleVersion:2,early:false};
  }
  function queue(cards,read,now=Date.now(),all=false) {
    return cards.filter(c=>all||!hasSchedule(read(c))||read(c).due<=now).sort((a,b)=>{
      const sa=read(a),sb=read(b),aNew=!hasSchedule(sa),bNew=!hasSchedule(sb);
      return Number(aNew)-Number(bNew)||(sa.due||0)-(sb.due||0)||b.date.localeCompare(a.date);
    });
  }
  function summary(cards,read,now=Date.now()) {
    const out={due:0,new:0,waiting:0,next:null};
    for(const c of cards) {
      const s=read(c);
      if(!hasSchedule(s))out.new++;
      else if(s.due<=now)out.due++;
      else {out.waiting++;out.next=out.next===null?s.due:Math.min(out.next,s.due);}
    }
    return out;
  }
  const api=Object.freeze({schedule,queue,summary,INTERVAL_DAYS});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.StudySpacing=api;
})(globalThis);
