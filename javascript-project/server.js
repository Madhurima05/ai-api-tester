if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
}
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Groq = require('groq-sdk');
const { chromium, firefox, webkit } = require('playwright');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/screenshots', express.static('screenshots'));

if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');
if (!fs.existsSync('history.json')) fs.writeFileSync('history.json', '[]');

async function runBrowserTests(url, browserName, engine) {
  const browserNames = { chromium: 'Chrome', firefox: 'Firefox', webkit: 'Safari' };
  let browser = null;
  const results = [];

  try {
    browser = await engine.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(url, { timeout: 20000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const screenshotPath = `screenshots/${browserName}-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const title = await page.title();
    results.push({
      name: `Page loads successfully on ${browserNames[browserName]}`,
      status: title ? 'PASS' : 'FAIL',
      detail: `Page title: "${title}"`,
      screenshot: '/' + screenshotPath,
      error: title ? null : 'Page title is empty'
    });

    const hasBody = await page.$('body') !== null;
    results.push({
      name: 'Page has a body element',
      status: hasBody ? 'PASS' : 'FAIL',
      detail: hasBody ? 'Body element found' : 'Body element missing',
      error: hasBody ? null : 'Body element not found'
    });

    const links = await page.$$eval('a', els => els.length);
    results.push({
      name: 'Page has navigation links',
      status: links > 0 ? 'PASS' : 'FAIL',
      detail: `Found ${links} links on the page`,
      error: links > 0 ? null : 'No links found'
    });

    const images = await page.$$eval('img', els => els.length);
    results.push({
      name: 'Page has images',
      status: images > 0 ? 'PASS' : 'FAIL',
      detail: `Found ${images} images on the page`,
      error: images > 0 ? null : 'No images found'
    });

    const hasForm = await page.$('form, input, button') !== null;
    results.push({
      name: 'Page has interactive elements',
      status: hasForm ? 'PASS' : 'FAIL',
      detail: hasForm ? 'Forms/inputs/buttons found' : 'No interactive elements found',
      error: hasForm ? null : 'No interactive elements found'
    });

    const hasHeading = await page.$('h1, h2') !== null;
    results.push({
      name: 'Page has headings',
      status: hasHeading ? 'PASS' : 'FAIL',
      detail: hasHeading ? 'Headings found on page' : 'No headings found',
      error: hasHeading ? null : 'No headings found'
    });

    const is404 = title.toLowerCase().includes('404') || title.toLowerCase().includes('not found');
    results.push({
      name: 'Page is not a 404 error',
      status: !is404 ? 'PASS' : 'FAIL',
      detail: !is404 ? 'Page loaded correctly' : 'Page appears to be a 404',
      error: !is404 ? null : 'Page title suggests 404 error'
    });

    await browser.close();
    return { browser: browserNames[browserName], results, screenshot: '/' + screenshotPath };

  } catch (error) {
    if (browser) { try { await browser.close(); } catch (e) {} }
    return {
      browser: browserNames[browserName],
      results: [{
        name: `Page loads on ${browserNames[browserName]}`,
        status: 'FAIL',
        detail: error.message,
        screenshot: null,
        error: error.message
      }],
      screenshot: null
    };
  }
}

app.post('/run-tests', async (req, res) => {
  try {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const url = req.body.url || 'https://jsonplaceholder.typicode.com';
    const description = req.body.description || 'Test main endpoints';
    const selectedBrowsers = req.body.browsers || ['chromium'];

    const discoveryResponse = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an API testing expert. Return ONLY a valid JSON array of exactly 5 test cases. No markdown, no explanation, no backticks. Just the raw JSON array starting with [ and ending with ].
Example:
[{"name":"GET posts returns 200","method":"GET","path":"/posts","expectedStatus":200,"body":null,"edgeCase":false}]`
        },
        {
          role: 'user',
          content: `Generate 5 API test cases (include 2 edge cases) for: ${url}. User wants to: ${description}. Return ONLY the JSON array.`
        }
      ]
    });

    let testCases = [];
    try {
      let raw = discoveryResponse.choices[0].message.content.trim();
      raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']');
      if (start !== -1 && end !== -1) raw = raw.substring(start, end + 1);
      testCases = JSON.parse(raw);
      if (!Array.isArray(testCases)) testCases = [];
    } catch (e) {
      testCases = [
        { name: 'GET homepage returns 200', method: 'GET', path: '/', expectedStatus: 200, body: null, edgeCase: false },
        { name: 'GET invalid page returns 404', method: 'GET', path: '/invalid-page-xyz', expectedStatus: 404, body: null, edgeCase: true },
        { name: 'GET sitemap returns 200', method: 'GET', path: '/sitemap.xml', expectedStatus: 200, body: null, edgeCase: false },
        { name: 'Edge: GET with long path returns 404', method: 'GET', path: '/a/b/c/d/e/f/g', expectedStatus: 404, body: null, edgeCase: true },
        { name: 'GET robots.txt returns 200', method: 'GET', path: '/robots.txt', expectedStatus: 200, body: null, edgeCase: false }
      ];
    }

    const apiResults = [];
    for (const tc of testCases) {
      try {
        let response;
        if (tc.method === 'POST') {
          response = await axios.post(`${url}${tc.path}`, tc.body || {}, { timeout: 8000 });
        } else {
          response = await axios.get(`${url}${tc.path}`, { timeout: 8000 });
        }
        const pass = response.status === tc.expectedStatus;
        apiResults.push({
          name: tc.name,
          status: pass ? 'PASS' : 'FAIL',
          expectedStatus: tc.expectedStatus,
          actualStatus: response.status,
          responseData: JSON.stringify(response.data).substring(0, 300),
          error: pass ? null : `Expected ${tc.expectedStatus} got ${response.status}`,
          edgeCase: tc.edgeCase || false
        });
      } catch (error) {
        const actualStatus = error.response ? error.response.status : 'N/A';
        const pass = actualStatus === tc.expectedStatus;
        apiResults.push({
          name: tc.name,
          status: pass ? 'PASS' : 'FAIL',
          expectedStatus: tc.expectedStatus,
          actualStatus: actualStatus,
          responseData: error.response ? JSON.stringify(error.response.data).substring(0, 300) : null,
          error: pass ? null : error.message,
          edgeCase: tc.edgeCase || false
        });
      }
    }

    const browserEngines = { chromium, firefox, webkit };
    const browserResults = [];
    for (const browserName of selectedBrowsers) {
      const engine = browserEngines[browserName];
      if (!engine) continue;
      const result = await runBrowserTests(url, browserName, engine);
      browserResults.push(result);
    }

    const passed = apiResults.filter(r => r.status === 'PASS').length;
    const failed = apiResults.filter(r => r.status === 'FAIL').length;

    const analysisResponse = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are an expert QA engineer. Analyze these test results and give a 2-3 sentence summary with recommendations.' },
        { role: 'user', content: `URL: ${url}\nAPI Results: ${JSON.stringify(apiResults)}\nBrowser Results: ${JSON.stringify(browserResults)}` }
      ]
    });

    const aiAnalysis = analysisResponse.choices[0].message.content;

    try {
      const history = JSON.parse(fs.readFileSync('history.json', 'utf8'));
      history.unshift({ url, timestamp: new Date().toISOString(), passed, failed, total: apiResults.length, browsers: selectedBrowsers });
      fs.writeFileSync('history.json', JSON.stringify(history.slice(0, 10)));
    } catch (e) {
      fs.writeFileSync('history.json', JSON.stringify([{ url, timestamp: new Date().toISOString(), passed, failed, total: apiResults.length, browsers: selectedBrowsers }]));
    }

    res.json({ apiResults, browserResults, passed, failed, aiAnalysis });

  } catch (error) {
    console.error('Server error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/history', (req, res) => {
  try {
    const history = JSON.parse(fs.readFileSync('history.json', 'utf8'));
    res.json(history);
  } catch (e) {
    res.json([]);
  }
});

app.listen(3000, () => {
  console.log('AI API Tester Pro running at http://localhost:3000');
});