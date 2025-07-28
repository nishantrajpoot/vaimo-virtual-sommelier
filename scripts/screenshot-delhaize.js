#!/usr/bin/env node
// Script to take a screenshot of the Delhaize wine listings page with custom cookie modal handling

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = 'https://www.delhaize.be/fr/shop/Vins-and-bubbles/c/v2WIN?q=%3Arelevance&sort=relevance';
  const outputDir = path.join(process.cwd(), 'public');
  const outputPath = path.join(outputDir, 'delhaize-bg.png');

  // Ensure public directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Launching browser to capture ${url}`);
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: 'new',
  });

  const page = await browser.newPage();
  // Set viewport to a more manageable aspect ratio for background
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto(url, { waitUntil: 'networkidle2' });

  // Wait for and accept the custom cookie consent modal
  try {
    console.log('Waiting for Delhaize cookie consent dialog...');
    await page.waitForSelector('dialog[data-testid="modal-window-COOKIES_CONSENT"]', { timeout: 10000 });

    await page.click('button[data-testid="cookie-popup-accept"]');
    console.log('Delhaize cookie consent accepted.');

    // Wait for modal to close
    await page.waitForTimeout(2000);
  } catch (err) {
    console.warn('Cookie modal not found or already dismissed.');
  }

  // Take screenshot
  console.log('Taking screenshot...');
  await page.screenshot({ path: outputPath, fullPage: true });
  console.log(`Screenshot saved to ${outputPath}`);

  await browser.close();
})();
