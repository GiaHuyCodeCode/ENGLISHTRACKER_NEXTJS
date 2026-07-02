const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000/teacher?tab=assignments_mgmt');
  await page.waitForTimeout(2000);
  
  // screenshot initial
  await page.screenshot({ path: 'initial.png' });
  
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
  await page.screenshot({ path: 'after-repetition.png' });
  
  // Select a date
  const dateInput = await page.$('input[type="date"]');
  if (dateInput) {
    await dateInput.type('06302026'); // MMDDYYYY format for puppeteer input usually
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'after-date.png' });

  await browser.close();
})();
