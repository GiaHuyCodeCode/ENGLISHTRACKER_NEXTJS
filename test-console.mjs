import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    errors.push(`[PAGE ERROR] ${error.message}`);
  });

  page.on('requestfailed', request => {
    errors.push(`[REQUEST FAILED] ${request.url()} - ${request.failure()?.errorText}`);
  });

  await page.goto('http://localhost:3000/student/tracking', { waitUntil: 'networkidle0' });
  
  if (errors.length > 0) {
    console.log(errors.join('\n'));
  } else {
    console.log("No errors found!");
  }
  
  await browser.close();
})();
