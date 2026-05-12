const puppeteer = require('puppeteer');
  const lighthouseModule = require('lighthouse');
  const lighthouse = lighthouseModule.default || lighthouseModule.navigation || lighthouseModule;
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

async function runLighthouseWithAuth(port, baseUrl, outputName) {
  console.log(`\n🚀 Starting Lighthouse audit for ${baseUrl} ...`);
  
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
    chromePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });
  
  const browser = await puppeteer.connect({
    browserURL: `http://localhost:${chrome.port}`
  });
  
  const page = await browser.newPage();
  
  // Navigate to login
  console.log('  → Navigating to login...');
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
  
  // Fill credentials
  console.log('  → Filling credentials...');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.type('input[type="email"]', 'sidhq@gmail.com');
  await page.type('input[type="password"]', 'RqvxlXB3MkjbSD5');
  
  // Submit login
  console.log('  → Submitting login...');
  await page.keyboard.press('Enter');
  
  // Wait for redirect to home page
  console.log('  → Waiting for authentication...');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
  
  const currentUrl = page.url();
  console.log(`  → Authenticated at: ${currentUrl}`);
  
  // Wait a bit for the Kanban board to load
  await new Promise(r => setTimeout(r, 3000));
  
  // Run Lighthouse on the authenticated page
  console.log('  → Running Lighthouse...');
  const result = await lighthouse(currentUrl, {
    port: chrome.port,
    output: ['json', 'html'],
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    settings: {
      emulatedFormFactor: 'desktop',
      throttlingMethod: 'simulate',
    }
  });
  
  // Save reports
  const reportDir = '/tmp/lighthouse-reports';
  fs.mkdirSync(reportDir, { recursive: true });
  
  fs.writeFileSync(path.join(reportDir, `${outputName}.json`), JSON.stringify(result.lhr, null, 2));
  // result.report is an array when multiple outputs requested
  const htmlReport = Array.isArray(result.report) ? result.report.find(r => r.includes('<!DOCTYPE html>')) || result.report[0] : result.report;
  fs.writeFileSync(path.join(reportDir, `${outputName}.html`), htmlReport);
  
  console.log(`  ✅ Saved: ${reportDir}/${outputName}.json`);
  console.log(`  ✅ Saved: ${reportDir}/${outputName}.html`);
  
  const scores = result.lhr.categories;
  console.log('\n  📊 Scores:');
  console.log(`     Performance:     ${Math.round(scores.performance.score * 100)}`);
  console.log(`     Accessibility:   ${Math.round(scores.accessibility.score * 100)}`);
  console.log(`     Best Practices:  ${Math.round(scores['best-practices'].score * 100)}`);
  console.log(`     SEO:             ${Math.round(scores.seo.score * 100)}`);
  
  const metrics = result.lhr.audits;
  console.log('\n  ⏱️  Key Metrics:');
  console.log(`     First Contentful Paint:  ${metrics['first-contentful-paint'].displayValue}`);
  console.log(`     Largest Contentful Paint: ${metrics['largest-contentful-paint'].displayValue}`);
  console.log(`     Total Blocking Time:      ${metrics['total-blocking-time'].displayValue}`);
  console.log(`     Cumulative Layout Shift:  ${metrics['cumulative-layout-shift'].displayValue}`);
  console.log(`     Speed Index:              ${metrics['speed-index'].displayValue}`);
  
  await browser.disconnect();
  await chrome.kill();
  
  return result.lhr;
}

module.exports = { runLighthouseWithAuth };
