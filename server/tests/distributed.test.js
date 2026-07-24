// server/tests/distributed.test.js
import axios from 'axios';

const API_KEY = 'ak_ce3d286b8d95bdbf09848007133138ddcebc224d6d2a3193'; // use your token bucket key, or any active key
const ROUTE = '/api/protected';
const INSTANCE_A = `http://localhost:5000${ROUTE}`;
const INSTANCE_B = `http://localhost:5001${ROUTE}`;
const TOTAL_REQUESTS = 50; // 25 to each instance, fired concurrently

const fire = (url) =>
  axios
    .get(url, { headers: { 'x-api-key': API_KEY } })
    .then(() => ({ allowed: true }))
    .catch((err) => {
      if (err.response?.status === 429) return { allowed: false };
      throw err;
    });

const main = async () => {
  const requests = [];

  for (let i = 0; i < TOTAL_REQUESTS; i++) {
    // alternate between the two instances so the load is evenly split
    const url = i % 2 === 0 ? INSTANCE_A : INSTANCE_B;
    requests.push(fire(url));
  }

  const results = await Promise.all(requests);

  const allowed = results.filter((r) => r.allowed).length;
  const rejected = results.filter((r) => !r.allowed).length;

  console.log(`\nDistributed test — ${TOTAL_REQUESTS} requests split across 2 instances`);
  console.log(`Allowed: ${allowed}`);
  console.log(`Rejected: ${rejected}`);
  console.log(
    `\nIf Redis atomicity holds, "Allowed" should match your key's configured limit/capacity ` +
      `regardless of which instance served each request.`
  );
};

main().catch((err) => {
  console.error('Test failed:', err.message);
  console.error('Make sure both server instances are running (ports 5000 and 5001).');
});