const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.toString());
  });
  
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000/teacher?tab=assignments_mgmt');
  await page.waitForTimeout(2000);
  
  // Click 'Spaced Repetition' filter
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('Spaced Repetition')) {
      await btn.click();
      break;
    }
  }
  await page.waitForTimeout(1000);
  
  // Select a date
  const dateInput = await page.$('input[type="date"]');
  if (dateInput) {
    await dateInput.type('06302026'); 
  }
  await page.waitForTimeout(1000);
  
  console.log('Done testing clicks.');

  await browser.close();
})();
