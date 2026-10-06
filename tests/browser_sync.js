// GitHub sync path. Run against the local preview (python3 -m http.server 8765) in a browser that can reach
// raw.githubusercontent.com. Scenario A replays GitHub's contents-API shape with a newer, unpublished day;
// scenario B uses the real Raw file on main; scenario C uses the real API (or its failure) without mocks.
async (page) => {
  const fs=require('fs'),path=require('path'),crypto=require('crypto');
  const ROOT=process.cwd(),API='https://api.github.com/repos/ychenfen/claude-math-408-handoff/contents/';
  const assert=(v,m)=>{if(!v)throw Error(m);};
  const blob=buf=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`),buf])).digest('hex');
  const listing=(dir,extra={})=>{
    const full=path.join(ROOT,dir);const names=fs.existsSync(full)?fs.readdirSync(full).filter(n=>/^\d{4}-\d{2}-\d{2}\.md$/.test(n)):[];
    const items=names.map(n=>({name:n,path:`${dir}/${n}`,type:'file',sha:blob(fs.readFileSync(path.join(full,n)))}));
    Object.entries(extra).forEach(([n,text])=>items.push({name:n,path:`${dir}/${n}`,type:'file',sha:blob(Buffer.from(text))}));
    return items;
  };
  const Q='../../问答记录/操作系统/2026-10-07.md';
  const fixtures={
    '问答记录/操作系统/2026-10-07.md':'# 2026-10-07 操作系统｜问答记录\n\n## 09:10　独立重做 PV-22\n\n（测试夹具，不是真实记录）\n',
    '每日复盘/操作系统/2026-10-07.md':`# 2026-10-07 操作系统｜测试夹具\n\n## 题目状态\n\n| 题目 | 状态 | 来源 | 卡点／错误步骤 → 更正 | 下次验证 |\n|---|---|---|---|---|\n| \`PV-22\` 三线程复数相加 | 隔日重做通过 | [09:10](${Q}) | — | 一周后再做 |\n| \`PV-23\` 哲学家＋碗 | 独立做对 | [09:10](${Q}) | — | — |\n\n## 作答记录\n\n| 编号 | 作答方式 | 作答内容／附件 | 核对结果 | 核对依据 | 来源 |\n|---|---|---|---|---|---|\n| \`PV-22\` | 独立 | [作答全文](${Q}) | 正确 | 原件已核 | [09:10](${Q}) |\n| \`PV-23\` | 有提示 | [作答全文](${Q}) | 正确 | 原件已核 | [09:10](${Q}) |\n\n## 下次先做\n\n- [ ] 测试\n`,
  };
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const raw=[];page.on('request',r=>{if(r.url().startsWith('https://raw.githubusercontent.com/'))raw.push(decodeURIComponent(r.url()));});
  const results={};
  // A: GitHub has a newer day than the snapshot; unchanged files must not be re-downloaded.
  await page.route(API+'**',r=>{const dir=decodeURIComponent(new URL(r.request().url()).pathname.split('/contents/')[1]);
    const extra=dir.endsWith('操作系统')?{'2026-10-07.md':fixtures[`${dir}/2026-10-07.md`]}:{};
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(listing(dir,extra))});});
  await page.route('https://raw.githubusercontent.com/**',r=>{const p=decodeURIComponent(new URL(r.request().url()).pathname).split('/main/')[1];
    if(fixtures[p])return r.fulfill({status:200,contentType:'text/plain; charset=utf-8',body:fixtures[p]});return r.continue();});
  await page.goto('http://127.0.0.1:8765/#os/2026-10-05/ledger');await page.waitForLoadState('networkidle');
  await page.locator('#sync-state',{hasText:'比快照新'}).waitFor();
  assert((await page.locator('#sync-state').textContent()).includes('2个文件比快照新'),'A: sync state '+await page.locator('#sync-state').textContent());
  await page.locator('.ledger-item[data-id="PV-22"]').waitFor();
  assert(await page.locator('.ledger-item[data-id="PV-22"]').count()===1,'A: one card per ID');
  const pv22=await page.locator('.ledger-item[data-id="PV-22"]').textContent();
  assert(pv22.includes('隔日重做通过')&&pv22.includes('10-05 作答待核实 → 10-07 隔日重做通过'),'A: cross-date trail '+pv22);
  const pv23=await page.locator('.ledger-item[data-id="PV-23"] header').textContent();
  assert(pv23.includes('作答待核实')&&!pv23.includes('独立做对'),'A: hinted attempt must not upgrade '+pv23);
  assert((await page.locator('.ledger-warning').textContent()).includes('PV-23'),'A: mismatch warning');
  assert(!raw.some(u=>u.includes('2026-10-05')),'A: unchanged files re-downloaded: '+raw.join(','));
  await page.getByRole('tab',{name:'每日复盘'}).click();
  assert((await page.locator('.record-list').textContent()).includes('2026-10-07'),'A: new date listed');
  if(process.env.SHOTS){await page.getByRole('tab',{name:'题目追踪'}).click();await page.locator('.ledger-item').first().waitFor();
    for(const [w,h,n] of [[1440,1000,'sync-desktop'],[390,844,'sync-mobile']]){await page.setViewportSize({width:w,height:h});await page.screenshot({path:`${process.env.SHOTS}/${n}.png`,fullPage:true});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'A: overflow at '+w);}
    await page.setViewportSize({width:1440,height:1000});}
  results.A='newer GitHub day merged; one card per ID; cross-date trail; hinted attempt not upgraded; unchanged files not refetched';
  // B: API says the OS review on main differs (true today: main still has the old version) → real Raw download.
  await page.unroute(API+'**');await page.unroute('https://raw.githubusercontent.com/**');raw.length=0;
  const realMainSha='e31b11284504af2acf5b3a8905897e0665420af0';
  await page.route(API+'**',r=>{const dir=decodeURIComponent(new URL(r.request().url()).pathname.split('/contents/')[1]);
    const items=listing(dir);if(dir==='每日复盘/操作系统')items.forEach(i=>i.sha=realMainSha);
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(items)});});
  await page.goto('http://127.0.0.1:8765/?b#os/2026-10-05/ledger');await page.waitForLoadState('networkidle');
  await page.locator('.ledger-missing, .ledger-item').first().waitFor();
  assert(raw.some(u=>u.endsWith('每日复盘/操作系统/2026-10-05.md')),'B: real Raw not requested');
  assert((await page.locator('#content').textContent()).includes('没有题目状态表'),'B: main version (no table) should be shown, not the snapshot');
  results.B='changed sha → real raw.githubusercontent.com main file loaded and shown as-is';
  // C: no mocks at all.
  await page.unroute(API+'**');
  await page.goto('http://127.0.0.1:8765/?c#os/2026-10-05/ledger');await page.waitForLoadState('networkidle');
  await page.waitForFunction(()=>!document.querySelector('#sync-state').textContent.includes('正在检查'),null,{timeout:20000});
  results.C='real API: '+await page.locator('#sync-state').textContent()+` · ${await page.locator('.ledger-item').count()} items`;
  assert(errors.length===0,'JS errors: '+errors.join(','));
  return {status:'PASS',results};
}
