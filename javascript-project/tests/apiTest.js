require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'https://jsonplaceholder.typicode.com';

async function runTests() {
  console.log('Running API Tests...\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`PASS: ${name}`);
      passed++;
    } catch (error) {
      console.log(`FAIL: ${name} — ${error.message}`);
      failed++;
    }
  }

  await test('GET /posts returns 200 and list', async () => {
    const res = await axios.get(`${BASE_URL}/posts`);
    if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
    if (!Array.isArray(res.data)) throw new Error('Expected array');
    console.log(`     Found ${res.data.length} posts`);
  });

  await test('GET /posts/1 returns valid post', async () => {
    const res = await axios.get(`${BASE_URL}/posts/1`);
    if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
    if (!res.data.title) throw new Error('No title found');
    console.log(`     Post title: ${res.data.title}`);
  });

  await test('POST /posts creates new post', async () => {
    const res = await axios.post(`${BASE_URL}/posts`, {
      title: 'AI QA Test Post',
      body: 'Created by AI QA Tester',
      userId: 1
    });
    if (res.status !== 201) throw new Error(`Expected 201 got ${res.status}`);
    console.log(`     Created post ID: ${res.data.id}`);
  });

  await test('GET /users returns list of users', async () => {
    const res = await axios.get(`${BASE_URL}/users`);
    if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
    if (!Array.isArray(res.data)) throw new Error('Expected array');
    console.log(`     Found ${res.data.length} users`);
  });

  await test('GET /posts/999 returns 404', async () => {
    try {
      await axios.get(`${BASE_URL}/posts/999`);
      throw new Error('Expected 404 but got success');
    } catch (error) {
      if (error.response?.status !== 404) throw new Error('Expected 404');
      console.log(`     Correctly returned 404`);
    }
  });

  console.log(`\n========================`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log(`========================`);
}

runTests();