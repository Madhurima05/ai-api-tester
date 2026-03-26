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
    const results = [];

    async function test(name, fn) {
      try {
        await fn();
        results.push({ name, status: 'PASS', error: null });
      } catch (error) {
        results.push({ name, status: 'FAIL', error: error.message });
      }
    }

    await test('GET /posts returns 200 and list', async () => {
      const res = await axios.get(`${baseUrl}/posts`);
      if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
      if (!Array.isArray(res.data)) throw new Error('Expected array');
    });

    await test('GET /posts/1 returns valid post', async () => {
      const res = await axios.get(`${baseUrl}/posts/1`);
      if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
      if (!res.data.title) throw new Error('No title found');
    });

    await test('POST /posts creates new post', async () => {
      const res = await axios.post(`${baseUrl}/posts`, {
        title: 'AI QA Test', body: 'Created by AI QA Tester', userId: 1
      });
      if (res.status !== 201) throw new Error(`Expected 201 got ${res.status}`);
    });

    await test('GET /users returns list', async () => {
      const res = await axios.get(`${baseUrl}/users`);
      if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
      if (!Array.isArray(res.data)) throw new Error('Expected array');
    });

    await test('GET /posts/999 returns 404', async () => {
      try {
        await axios.get(`${baseUrl}/posts/999`);
        throw new Error('Expected 404 but got success');
      } catch (error) {
        if (error.response?.status !== 404) throw new Error('Expected 404');
      }
    });

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are an expert QA engineer. Analyze test results and give a 2-3 sentence summary with recommendations.' },
        { role: 'user', content: `Analyze these API test results:\n${JSON.stringify(results, null, 2)}` }
      ]
    });

    const aiAnalysis = completion.choices[0].message.content;
    res.json({ results, passed, failed, aiAnalysis });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('AI API Tester running at http://localhost:3000');
});