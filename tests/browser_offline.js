// Offline copy and progress backup. Run against the local preview on port 8878 with Playwright.
async (browserPage) => {
  const browser=browserPage.context().browser(),BASE='http://127.0.0.1:8878',fs=require('fs'),path=require('path'),os=require('os');
  const assert=(v,m)=>{if(!v)throw Error(m);};
  const a=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),page=await a.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.route('https://api.github.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    await page.goto(BASE+'/#all');await page.waitForLoadState('networkidle');
    await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForLoadState('networkidle');
    assert(await page.evaluate(()=>!!navigator.serviceWorker.controller),'Service worker controls the page');
    assert(await page.evaluate(async()=>(await fetch('manifest.webmanifest').then(r=>r.json())).shortcuts[0].url==='./#bed'),'Manifest with bedtime shortcut');
    // Rate one card so there is progress to carry.
    await page.goto(BASE+'/#os/2026-10-05/drill');await page.locator('.recall-answer').waitFor();
    await page.getByRole('button',{name:'我已回想，查看参考要点'}).click();await page.getByRole('button',{name:/^会了/}).click();
    await a.setOffline(true);
    await page.goto(BASE+'/#all');await page.locator('.all-row').first().waitFor({timeout:15000});
    assert(await page.locator('.all-row').count()===6,'Overview opens offline');
    await page.locator('.rt-bed').click();await page.locator('.bed').waitFor();
    assert((await page.locator('.bed h1').textContent()).includes('张'),'Bedtime review opens offline');
    await page.keyboard.press('Escape');
    await a.setOffline(false);
    const dl=page.waitForEvent('download');await page.locator('#backup-out').click();const file=path.join(os.tmpdir(),'wengu-backup-test.json');await (await dl).saveAs(file);
    const backup=JSON.parse(fs.readFileSync(file,'utf8'));
    assert(backup.app==='wengu-progress'&&Object.keys(backup.items).some(k=>k.startsWith('study-drill-v1:os:')),'Backup holds the rating');
    // Second device: empty browser restores the backup; an older copy never overwrites a newer local review.
    const b=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'}),p2=await b.newPage();
    await p2.route('https://api.github.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    await p2.goto(BASE+'/#all');await p2.locator('.review-today').waitFor();
    const key=Object.keys(backup.items).find(k=>k.startsWith('study-drill-v1:os:'));
    await p2.evaluate(([k])=>localStorage.setItem(k,JSON.stringify({rating:'不会',reviewedAt:'2099-01-01T00:00:00Z',due:1})),[key]);
    const other=JSON.parse(backup.items[key]);backup.items['study-drill-v1:ds:test']=JSON.stringify({...other});fs.writeFileSync(file,JSON.stringify(backup));
    await p2.locator('#backup-in').setInputFiles(file);await p2.waitForTimeout(400);
    const kept=await p2.evaluate(([k])=>JSON.parse(localStorage.getItem(k)).rating,[key]);
    assert(kept==='不会','Newer local review kept over older backup');
    assert(await p2.evaluate(()=>!!localStorage.getItem('study-drill-v1:ds:test')),'Missing entries restored');
    await p2.locator('#backup-in').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"x":1}')});
    assert((await p2.locator('#toast').textContent()).includes('不是有效'),'Rejects foreign files');
    await b.close();
    assert(errors.length===0,'Page errors: '+errors.join(','));
    return {status:'PASS',checks:['service worker','manifest shortcut','offline overview','offline bedtime','backup export','restore merge keeps newer','foreign file rejected']};
  } finally {await a.close();}
}
