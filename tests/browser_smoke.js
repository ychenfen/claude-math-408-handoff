async (page) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://api.github.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const assert=(v,m)=>{if(!v)throw Error(m);};
  try {
    await page.setViewportSize({width:1440,height:1000});
    await page.goto('http://127.0.0.1:8765/#os/2026-10-05/daily');await page.waitForLoadState('networkidle');
    assert(await page.locator('details.selftest').count()===4,'OS self-tests missing');
    assert(await page.locator('details.selftest[open]').count()===0,'Answers should start hidden');
    await page.locator('details.selftest summary').first().click();
    assert(await page.locator('details.selftest[open]').count()===1,'Reveal failed');
    await page.getByRole('tab',{name:'当天问答'}).click();
    assert((await page.locator('#content').textContent()).includes('14:51'),'OS original Q&A missing');
    assert(!(await page.locator('#content').textContent()).includes('暴力解手册'),'Subjects mixed');
    await page.locator('[data-subject="ds"]').click();await page.waitForLoadState('networkidle');
    assert(await page.locator('details.selftest').count()===3,'DS summary missing');
    assert(await page.locator('.katex').count()>0,'Math not rendered');
    await page.locator('#draft').fill('自动测试草稿：不公开上传');await page.locator('#reviewed').click();
    await page.reload();await page.waitForLoadState('networkidle');
    assert(await page.locator('#draft').inputValue()==='自动测试草稿：不公开上传','Draft persistence');
    assert((await page.locator('#reviewed').textContent()).includes('已标记'),'Review persistence');
    await page.locator('[data-subject="os"]').click();assert(await page.locator('#draft').inputValue()==='','Subject draft isolation');
    await page.locator('[data-subject="math"]').click();await page.waitForLoadState('networkidle');
    assert((await page.locator('#content').textContent()).includes('还没有本科复盘'),'Missing date fabricated');
    assert(await page.locator('#reviewed').isDisabled(),'Empty day should not be markable');
    await page.getByRole('tab',{name:'过往记录'}).click();await page.getByRole('searchbox').fill('arctan');
    assert(await page.locator('details.archive').count()===2,'History search');
    assert(!(await page.locator('details.archive summary').first().textContent()).includes('公开脱敏'),'Invalid archive title');
    await page.locator('details.archive summary').first().click();
    await page.locator('details.archive article').first().waitFor();
    assert(await page.locator('details.archive article').count()===1,'History not expanded');
    await page.getByRole('tab',{name:'交给助手'}).click();
    assert((await page.locator('#prompt-text').inputValue()).includes('【高等数学】'),'Wrong subject prompt');
    await page.locator('[data-subject="linear"]').click();await page.locator('[data-subject="co"]').click();await page.locator('[data-subject="net"]').click();
    assert(await page.locator('#subject-title').textContent()==='计算机网络','Six-subject routing');
    await page.locator('#date').fill('2026-10-06');await page.locator('#date').dispatchEvent('change');
    assert((await page.locator('#content').textContent()).includes('还没有本科复盘'),'Empty-date state');
    await page.locator('[data-subject="os"]').click();await page.waitForLoadState('networkidle');
    const download=page.waitForEvent('download');await page.locator('#export').click();
    assert((await download).suggestedFilename().includes('操作系统'),'Export filename');
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow');
    await page.screenshot({path:'/tmp/study-mobile.png',fullPage:true});
    await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/study-desktop-final.png',fullPage:false});
    await page.evaluate(()=>{localStorage.removeItem('study-v1:ds:2026-10-05:draft');localStorage.removeItem('study-v1:ds:2026-10-05:reviewed');});
    assert(errors.length===0,'JS errors: '+errors.join(','));
    return {status:'PASS',checks:['six subjects','strict subject separation','hidden answers','math rendering','draft persistence and isolation','review marker','empty-date state','search','assistant prompt','Markdown download','mobile overflow','no JS errors']};
  } finally {
    await page.evaluate(()=>{localStorage.removeItem('study-v1:ds:2026-10-05:draft');localStorage.removeItem('study-v1:ds:2026-10-05:reviewed');});
    await page.unroute('https://api.github.com/**');
  }
}
