// server/tests/concurrency.test.js
import axios from 'axios';

const BASE_URL = 'http://localhost:5000';
const API_KEY = 'concurrency-test-key';

const runConcurrencyTest = async (endpoint, totalRequests = 50) => {
  const requests = Array.from({ length: totalRequests }, () =>
    axios
      .get(`${BASE_URL}${endpoint}`, { headers: { 'x-api-key': API_KEY } })
      .then((res) => res.status)
      .catch((err) => err.response?.status)
  );

  const results = await Promise.all(requests);

  const allowed = results.filter((s) => s === 200).length;
  const rejected = results.filter((s) => s === 429).length;

  console.log(`${endpoint} → Allowed: ${allowed}, Rejected: ${rejected}`);
};

const main = async () => {
  await runConcurrencyTest('/api/demo-fixed');
  await runConcurrencyTest('/api/demo-sliding');
  await runConcurrencyTest('/api/demo-bucket');
};

main();