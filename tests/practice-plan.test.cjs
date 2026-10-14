// All fixtures below are invented. They contain no user study records or personal answers.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../assets/practice-plan.js');
const doc=(text,date='2099-01-01')=>({text,date,path:'fixtures/subject-a/'+date+'.md'});
const subject=(records,name='测试科目A',id='co')=>({records,name,id});
test('reuse of named subquestion merges history without merging distinct checks',()=>{
  const s=subject([doc('## 08:00 测试记录\n\n**漏洞**：两个卡点\n\n**检验**：(a) 执行步骤甲。(b) 计算字段乙。\n\n## 09:00 408-2099-905 字段乙\n\n**检验**：仍用 08:00 迁移题 (b)：计算字段乙。\n\n## 10:00 408-2099-906 步骤甲\n\n**检验**：仍用 08:00 迁移题 (a)：执行步骤甲。')]);
  const g=P.groupsOf([s]);assert.equal(g.length,2);assert.deepEqual(g.map(x=>x.members.length),[2,2]);
  assert(g.every(x=>!x.check.includes('仍用')));
});
test('same question number alone cannot merge different gaps; latest explicit result survives discussion',()=>{
  const s=subject([doc('## 08:00 408-2099-901 测试主题A\n\n**检验**：计算容量。\n\n**检验结果**：通过（01-01）\n\n## 09:00 408-2099-901 测试主题A\n\n**检验**：计算容量。\n\n## 10:00 408-2099-901 测试主题A\n\n**检验**：计算命中率。')]);
  const g=P.groupsOf([s]);assert.equal(g.length,2);assert.equal(g[0].status,'已通过');assert.equal(g[1].status,'待检验');
  s.records.push(doc('## 08:00 408-2099-901 测试主题A\n\n**检验**：计算容量。\n\n**检验结果**：未通过（01-02）','2099-01-02'));
  assert.equal(P.groupsOf([s])[0].status,'未通过');
});
test('inherited original conditions are included without answer or correction',()=>{
  const s=subject([doc('## 08:00 408-2099-904 测试主题D\n\n**题**（题意整理）：条件甲=11，条件乙=22。\n\n**正确要点**：秘密答案\n\n**检验**：同上题，目标改为33。')]);
  const context=P.contextOf(P.groupsOf([s])[0]);assert(context.includes('条件甲=11'));assert(context.includes('33'));assert(!context.includes('秘密答案'));assert(context.includes('题意整理'));
});
test('priorities exclude passed checks, match full IDs, and spread across subjects',()=>{
  const co=subject([doc('## 08:00 408-2099-901 测试主题A\n\n**检验**：容量。\n\n## 09:00 408-2099-902 地址\n\n**检验**：地址。')]);
  const ds=subject([doc('## 08:00 408-2099-903 测试主题B\n\n**检验**：测试主题B。')],'测试科目B','ds');
  const os=subject([doc('## 08:00 408-2099-904 测试主题C\n\n**检验**：测试主题C。')],'测试科目C','os');
  const exams=[{date:'2099-01-01',score:{subject:'408',paper:'2099 测试卷'},items:[{id:'901',subject:co.name,full:10,got:4},{id:'902',subject:co.name,full:10,got:4},{id:'903',subject:ds.name,full:10,got:5},{id:'904',subject:os.name,full:10,got:6},{id:'9',subject:co.name,full:100,got:0}]}];
  const g=P.groupsOf([co,ds,os]);const picked=P.priorities(g,exams);
  assert.equal(picked.length,3);assert.equal(new Set(picked.map(x=>x.subject.id)).size,3);
  assert(picked.filter(x=>x.subject.id==='co')[0].reasons[0].includes('丢 6 分'));
  g.forEach(x=>x.status='已通过');assert.equal(P.priorities(g,exams).length,0);
  assert.equal(P.priorities([],[]).length,0);
});
test('submission preserves answer and refuses to infer independence or permission to upload',()=>{
  const text=P.submission({subject:{name:'测试科目C'},question:'测试主题C',context:'条件甲=11',note:'我的测试过程\n结果甲',path:'fixtures/subject-c/2099-01-01.md',today:'2099-01-02',revealed:true});
  assert(text.includes('我的测试过程\n结果甲'));assert(text.includes('参考要点已经展开'));assert(text.includes('由我补充确认'));assert(text.includes('公开上传仍需我的授权'));assert(!text.includes('参考答案：'));
});
