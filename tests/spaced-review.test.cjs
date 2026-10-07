const {test}=require('node:test');
const assert=require('node:assert/strict');
const {schedule,queue,summary}=require('../assets/spaced-review.js');
const DAY=86400000,NOW=Date.parse('2026-10-07T02:00:00Z');
const vm=require('node:vm'),fs=require('node:fs');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(require.resolve('../assets/review-tools.js'),'utf8'),sandbox);
const cardsOf=sandbox.window.StudyReview.cardsOf;
test('card context is separate from hidden answer; code and legacy formats survive',()=>{
  const doc={path:'test.md',date:'2026-10-07',text:'### 自测：代码题\n\n**题干**：给定共享变量y。\n\n```c\ny = add(y, w);\n```\n\n**参考要点**：答案秘密\n\n### 自测：旧题\n\n旧答案\n'};
  const cards=cardsOf([doc]);
  assert.equal(cards.length,2);assert.match(cards[0].context,/y = add/);
  assert.doesNotMatch(cards[0].context,/答案秘密/);assert.match(cards[0].answer,/答案秘密/);
  assert.equal(cards[1].context,'');assert.equal(cards[1].answer,'旧答案');
  const revised=cardsOf([{...doc,text:doc.text.replace('共享变量y','共享变量z')}]);
  assert.notEqual(revised[0].id,cards[0].id);assert.equal(revised[1].id,cards[1].id);
});
test('all published recall cards have standalone context and source labels',()=>{
  const data=JSON.parse(fs.readFileSync(require.resolve('../assets/data.json'),'utf8'));
  const cards=cardsOf(data.subjects.flatMap(s=>s.summaries));
  assert.equal(cards.length,11);
  for(const card of cards){assert.match(card.context,/\*\*题干\*\*：/);assert.match(card.answer,/^\*\*参考要点\*\*/);}
  const pv=cards.find(c=>c.question.includes('thread3写y'));
  for(const code of ['thread1','thread2','thread3','float a','w.a = 1','z = add(z, w)','y = add(y, w)'])assert.ok(pv.context.includes(code),code);
  assert.match(pv.context,/2017/);
});
test('success progresses 1, 3, 7, 14, 30, 60 days, then caps at 60',()=>{
  let state={},now=NOW;
  for(const days of [1,3,7,14,30,60,60]) {
    state=schedule(state,'会了',now);assert.equal(state.due-now,days*DAY);now=state.due;
  }
});
test('forgotten resets to ten minutes and the next successful recall is one day',()=>{
  const forgotten=schedule({level:5,due:NOW},'不会',NOW);
  assert.equal(forgotten.level,0);assert.equal(forgotten.due,NOW+600000);
  assert.equal(schedule(forgotten,'会了',forgotten.due).due-forgotten.due,DAY);
});
test('uncertain gets tomorrow and falls back a level',()=>{
  const s=schedule({level:4,due:NOW},'模糊',NOW);
  assert.equal(s.level,3);assert.equal(s.due,NOW+DAY);
});
test('early extra success does not advance level or postpone the due date',()=>{
  const s={level:3,due:NOW+7*DAY};const next=schedule(s,'会了',NOW);
  assert.equal(next.level,3);assert.equal(next.due,s.due);assert.equal(next.early,true);
});
test('legacy browser data remains scheduled without inventing several successes',()=>{
  const old={rating:'会了',due:NOW+DAY,note:'keep me'};
  const next={...old,...schedule(old,'会了',NOW)};
  assert.equal(next.due,old.due);assert.equal(next.level,1);assert.equal(next.note,'keep me');
});
test('due cards precede new ones; future ones excluded',()=>{
  const cards=['new','later','overdue','due'].map(id=>({id,date:'2026-10-05'}));
  const states={later:{due:NOW+1},overdue:{due:NOW-100},due:{due:NOW}};
  const read=c=>states[c.id]||{};
  assert.deepEqual(queue(cards,read,NOW).map(c=>c.id),['overdue','due','new']);
  assert.deepEqual(summary(cards,read,NOW),{due:2,new:1,waiting:1,next:NOW+1});
});
test('invalid local level cannot produce an invalid date',()=>{
  for(const level of [-4,99,NaN,'2'])assert.equal(schedule({level},'会了',NOW).due,NOW+DAY);
  assert.throws(()=>schedule({},'掌握',NOW));
});
