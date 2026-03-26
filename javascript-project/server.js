require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/run-tests', async (req, res) => {
  try {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const baseUrl = req.body.url || 'https://jsonplaceholder.typicode.com';

    const discoveryResponse = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an API testing expert. Given an API base URL, return ONLY a JSON array of 5 test cases. No explanation, no markdown, just raw JSON array like this:
[
  {"name": "test name", "method": "GET", "path": "/endpoint", "expectedStatus": 200, "body": null},
  {"name": "test name", "method": "POST", "path": "/endpoint", "expectedStatus": 201, "body": {"key": "value"}}
]`
        },
        {
          role: 'user',
          content: `Generate 5 test cases for this API: ${baseUrl}. Use only public endpoints that don't require authentication. Return ONLY the JSON array.`
        }
      ]
    });

    let testCases = [];
    try {
      const raw = discoveryResponse.choices[0].message.content.trim();
      const cleaned = raw.replace(/```json|```/g, '').trim();
      testCases = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ error: 'AI could not generate test cases for this API. Try a different URL.' });
    }

    const results = [];

    for (const tc of testCases) {
      try {
        let response;
        if (tc.method === 'POST') {
          response = await axios.post(`${baseUrl}${tc.path}`, tc.body || {}, { timeout: 8000 });
        } else {
          response = await axios.get(`${baseUrl}${tc.path}`, { timeout: 8000 });
        }

        if (response.status === tc.expectedStatus) {
          results.push({ name: tc.name, status: 'PASS', error: null });
        } else {
          results.push({ name: tc.name, status: 'FAIL', error: `Expected ${tc.expectedStatus} got ${response.status}` });
        }
      } catch (error) {
        const actualStatus = error.response?.status;
        if (actualStatus === tc.expectedStatus) {
          results.push({ name: tc.name, status: 'PASS', error: null });
        } else {
          results.push({ name: tc.name, status: 'FAIL', error: error.message });
        }
      }
    }

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    const analysisResponse = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are an expert QA engineer. Analyze test results and give a 2-3 sentence summary with recommendations.' },
        { role: 'user', content: `API tested: ${baseUrl}\nResults:\n${JSON.stringify(results, null, 2)}` }
      ]
    });

    const aiAnalysis = analysisResponse.choices[0].message.content;
    res.json({ results, passed, failed, aiAnalysis });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('AI API Tester running at http://localhost:3000');
});