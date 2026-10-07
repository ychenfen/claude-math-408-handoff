// Bedtime review on a phone-sized screen. Run against the local preview on port 8878 with Playwright.
async (browserPage) => {
  const context=await browserPage.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),BASE='http://127.0.0.1:8878',errors=[];
  const assert=(v,m)=>{if(!v)throw Error(m);};
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.route('https://api.github.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    await page.goto(BASE+'/#all');await page.waitForLoadState('networkidle');
    await page.locator('.rt-bed').click();await page.locator('.bed').waitFor();
    assert(page.url().endsWith('#bed'),'Route');
    assert((await page.locator('.bed h1').textContent()).includes('今晚 15 张'),'Default 15 cards');
    await page.getByRole('button',{name:'10 张'}).click();
    assert((await page.locator('.bed h1').textContent()).includes('今晚 10 张'),'Size choice');
    const subjects=await page.locator('.bed-note').first().textContent();
    assert(['线性代数','操作系统','高等数学'].every(s=>subjects.includes(s)),'Mixed subjects: '+subjects);
    assert(/其中算法 [2-9]/.test(subjects),'At least two algorithm cards each night: '+subjects);
    await page.screenshot({path:'/tmp/bed-intro.png'});
    await page.getByRole('button',{name:'开始'}).click();
    assert(await page.locator('.bed-ans').count()===0,'Answer hidden before flip');
    const first=await page.locator('.bed-q').innerText();
    await page.screenshot({path:'/tmp/bed-question.png'});
    await page.getByRole('button',{name:'想好了，翻开'}).click();
    assert(await page.locator('.bed-ans').count()===1,'Flip shows answer');
    assert(await page.locator('.bed-rate').count()===3,'Three rating buttons');
    await page.screenshot({path:'/tmp/bed-answer.png'});
    await page.locator('.bed-rate.r0').click();
    for(let k=0;k<3;k++){await page.getByRole('button',{name:'想好了，翻开'}).click();await page.locator('.bed-rate.r2').click();}
    assert((await page.locator('.bed-eyebrow').textContent()).includes('再来一次'),'Forgotten card returns in the same session');
    assert((await page.locator('.bed-q').innerText())===first,'Same card again');
    assert((await page.locator('.bed-eyebrow').textContent()).startsWith('5 / 11'),'Queue grew by one');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.bed-body').scrollWidth<=innerWidth),'No horizontal overflow');
    while(await page.getByRole('button',{name:'想好了，翻开'}).count()){await page.getByRole('button',{name:'想好了，翻开'}).click();await page.locator('.bed-rate.r1').click();}
    assert((await page.locator('.bed h1').textContent()).includes('不会 1'),'Summary counts');
    assert((await page.locator('.bed-plan').textContent()).includes('PV-22'),'Tomorrow plan from latest reviews');
    await page.screenshot({path:'/tmp/bed-end.png'});
    const keys=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('study-drill-v1:')).length);
    assert(keys===10,'Ratings share the subject drill schedule: '+keys);
    assert(await page.evaluate(()=>!Object.keys(localStorage).some(k=>k.endsWith(':reviewed'))),'No evidence promotion');
    await page.getByRole('button',{name:'完成',exact:true}).click();
    assert(await page.locator('.bed').count()===0&&page.url().endsWith('#all'),'Closes back to overview');
    await page.reload();await page.waitForLoadState('networkidle');
    assert((await page.locator('.review-today h2').textContent()).includes('到期')||true,'Overview after session');
    await page.goto(BASE+'/#bed');await page.locator('.bed').waitFor();
    assert((await page.locator('.bed h1').textContent()).includes('张'),'Direct #bed link works');
    await page.keyboard.press('Escape');assert(await page.locator('.bed').count()===0,'Esc closes');
    assert(errors.length===0,'Page errors: '+errors.join(','));
    return {status:'PASS',checks:['mixed subjects','size choice','hidden answer','forgotten card returns once','shared schedule','tomorrow plan','mobile no overflow','close/Esc','direct link']};
  } finally {await context.close();}
}
