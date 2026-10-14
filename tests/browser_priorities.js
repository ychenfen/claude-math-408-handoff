// Run with Playwright against the local preview at port 8878.
async (browserPage) => {
  const browser=browserPage.context().browser();
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage(),BASE='http://127.0.0.1:8878',errors=[];
  const assert=(v,m)=>{if(!v)throw Error(m);};
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.route('https://api.github.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    await page.goto(BASE+'/#all');await page.locator('.priority-task').first().waitFor();
    assert(await page.locator('.priority-task').count()===3,'Three priority tasks');
    assert((await page.locator('.priority-task').first().innerText()).includes('Cache'),'Latest exam prioritizes Cache');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overview has no horizontal overflow');
    await page.locator('.priority-task').filter({hasText:'操作系统'}).getByRole('button').click();
    await page.locator('#practice-answer').waitFor();
    assert(await page.evaluate(()=>scrollY===0),'Opening a task resets the long overview scroll position');
    const text=await page.locator('#content').innerText();
    assert(text.includes('页大小 1KB')&&text.includes('1BCDH'),'Inherited conditions and changed address visible');
    assert(!text.includes('1FCAH'),'Original correction does not leak');
    await page.locator('#practice-answer').fill('浏览器测试草稿：先求页号和偏移。');
    await page.reload();await page.locator('#practice-answer').waitFor();
    assert((await page.locator('#practice-answer').inputValue()).includes('浏览器测试草稿'),'Practice draft survives route reload and sync');
    await page.getByRole('button',{name:'复制本题作答，请助手核对',exact:true}).click();
    await page.getByRole('status').filter({hasText:'已复制'}).waitFor();
    const copied=await page.evaluate(()=>navigator.clipboard.readText());
    assert(copied.includes('浏览器测试草稿')&&copied.includes('1BCDH'),'Clipboard contains answer and full context');
    assert(copied.includes('是否独立')&&!copied.includes('1FCAH'),'Clipboard makes no mastery claim and contains no original answer');
    assert(await page.evaluate(()=>!Object.entries(localStorage).some(([k,v])=>k.includes('reviewed')||v==='独立做对')),'Copy never promotes evidence');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile practice has no horizontal overflow');
    await page.goto(BASE+'/#co/2026-10-10/drill');await page.locator('#recall-answer').waitFor();
    await page.locator('#recall-answer').fill('自测答案草稿');
    await page.getByRole('button',{name:'我已回想，查看参考要点',exact:true}).click();
    await page.getByRole('button',{name:'复制本题作答，请助手核对',exact:true}).click();
    await page.getByRole('status').filter({hasText:'已复制'}).waitFor();
    const drillCopy=await page.evaluate(()=>navigator.clipboard.readText());
    assert(drillCopy.includes('自测答案草稿')&&drillCopy.includes('参考要点已经展开'),'Revealed flag is disclosed');
    assert(!drillCopy.includes('机器码 0010 000 100'),'Reference answer is not copied');
    // Clipboard failures leave selectable text rather than silently dropping the answer.
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(Error('denied'))},configurable:true}));
    await page.getByRole('button',{name:'复制本题作答，请助手核对',exact:true}).click();
    await page.getByRole('textbox',{name:'手动复制本题核对内容'}).waitFor();
    assert((await page.getByRole('textbox',{name:'手动复制本题核对内容'}).inputValue()).includes('自测答案草稿'),'Manual fallback preserves answer');
    await page.setViewportSize({width:1440,height:1000});await page.goto(BASE+'/#all');await page.locator('.priority-task').first().waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Desktop has no horizontal overflow');
    assert(errors.length===0,'Page errors: '+errors.join(', '));
    return {status:'PASS',checks:['priority ranking','mobile and desktop','standalone question','draft persistence','clipboard and fallback','answer visibility disclosure','no evidence promotion']};
  } finally {await context.close();}
}
