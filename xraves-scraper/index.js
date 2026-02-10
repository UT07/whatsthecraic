const express = require('express');
const { chromium } = require('playwright-core');

const PORT = process.env.PORT || 4010;
const BASE_URL = process.env.XRAVES_BASE_URL || 'https://xraves.ie/';
const USER_AGENT = process.env.XRAVES_USER_AGENT
  || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const HEADLESS = (process.env.SCRAPER_HEADLESS || 'true') === 'true';

const app = express();
app.use(express.json({ limit: '2mb' }));

let browserPromise = null;

const getBrowser = async () => {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: HEADLESS,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    });
  }
  return browserPromise;
};

const NEXT_DATA_REGEX = new RegExp('<script[^>]*id=\"__NEXT_DATA__\"[^>]*>([\\s\\S]*?)<\\/script>', 'i');

const extractNextDataFromHtml = (html) => {
  if (!html) return null;
  const match = html.match(NEXT_DATA_REGEX);
  if (!match || !match[1]) return null;
  return match[1];
};

const createContext = async (userAgent) => {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent,
    locale: 'en-US',
    timezoneId: 'Europe/Dublin',
    viewport: { width: 1280, height: 720 }
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });
  return context;
};

const scrapeNextData = async (targetUrl, userAgent) => {
  const browser = await getBrowser();
  const context = await createContext(userAgent);
  const page = await context.newPage();

  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font'].includes(type)) {
      return route.abort();
    }
    return route.continue();
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);
  try {
    const title = await page.title();
    if (title && /just a moment|attention required|checking your browser/i.test(title)) {
      await page.waitForLoadState('networkidle', { timeout: 45000 });
    }
  } catch (error) {
    // ignore title/load-state failures
  }

  let nextData = null;
  try {
    await page.waitForFunction(
      () => Boolean(document.querySelector('#__NEXT_DATA__')?.textContent),
      { timeout: 45000 }
    );
    nextData = await page.$eval('#__NEXT_DATA__', (el) => el.textContent);
  } catch (error) {
    const html = await page.content();
    nextData = extractNextDataFromHtml(html);
    if (!nextData) {
      await page.waitForTimeout(5000);
      const htmlRetry = await page.content();
      nextData = extractNextDataFromHtml(htmlRetry);
    }
  }

  if (!nextData) {
    throw new Error('Missing __NEXT_DATA__ in page content');
  }
  await page.close();
  await context.close();
  return nextData;
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/scrape', async (req, res) => {
  const targetUrl = req.body?.url || BASE_URL;
  const userAgent = req.body?.userAgent || USER_AGENT;

  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).json({ error: 'Missing target url' });
  }

  try {
    const nextData = await scrapeNextData(targetUrl, userAgent);
    return res.json({ ok: true, nextData });
  } catch (error) {
    console.error('Scrape failed:', error.message);
    return res.status(502).json({ ok: false, error: error.message });
  }
});

const shutdown = async () => {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

app.listen(PORT, () => {
  console.log(`XRaves scraper listening on ${PORT}`);
});
