API Rate Limiter

A full-stack rate limiting system built with the MERN stack, implementing three industry-standard rate limiting algorithms (Fixed Window, Token Bucket, Sliding Window Counter) with Redis-backed atomic enforcement, MongoDB-persisted API key management, and a React admin dashboard for key management, live traffic monitoring, and algorithm comparison.

Table of Contents
Architecture
Algorithms Implemented
Tech Stack
Project Structure
Setup
API Reference
Design Decisions & Tradeoffs
Testing & Verification
Load Test Results
Known Limitations
Lessons Learned
Architecture
┌─────────────┐         ┌──────────────────┐         ┌─────────┐
│   React     │  HTTP   │   Express API    │  atomic │  Redis  │
│  Dashboard  │────────▶│  (rate limiter    │────────▶│ (limit  │
│  (Vite)     │         │   middleware)     │  ops    │ state)  │
└─────────────┘         └────────┬──────────┘         └─────────┘
                                  │
                                  │ async, batched
                                  ▼
                            ┌───────────┐
                            │  MongoDB   │
                            │ (API keys, │
                            │ request    │
                            │  logs)     │
                            └───────────┘

Request flow (dynamic route, e.g. /api/protected):

Client sends request with x-api-key header
Middleware looks up that key's rate-limit config — checked in Redis first (60s cache), falls back to MongoDB on a cache miss, repopulates Redis either way
The configured algorithm (fixed window / token bucket / sliding window) runs as an atomic Redis operation (Lua script for token bucket, INCR+EXPIRE for fixed window) so concurrent requests across multiple server instances can never race past the limit
Response returned immediately; the request's outcome (allowed/rejected) is pushed to an in-memory queue and flushed to MongoDB in batches every 5 seconds — logging never blocks the response path
Dashboard polls /stats/traffic/:apiKey for live charts, and /admin/keys for key management

Why Redis is the source of truth for enforcement, not Mongo: rate limit checks need to happen on every request, sub-millisecond, and be atomic under concurrency. Redis's single-threaded command execution plus Lua scripting gives atomic read-modify-write in one round trip. Mongo holds the durable configuration (what limits a key should have); Redis holds the fast-moving counters (what a key has used).

Algorithms Implemented
Algorithm	Behavior	Best for
Fixed Window	Hard reset of the counter at fixed time boundaries (e.g. every 30s). Simple, but allows bursts at window edges (2x limit possible right at a boundary).	Simple, predictable quotas
Token Bucket	Bucket holds up to capacity tokens, refills continuously at refillRatePerSec. Allows bursts up to capacity, then throttles to the sustained refill rate.	APIs needing burst tolerance with a steady-state cap
Sliding Window Counter	Weighted estimate using the current + previous fixed windows, smoothing out the boundary-burst problem of fixed window.	Smoother enforcement without full sliding-log memory cost

All three are implemented as atomic Redis operations — fixed window and sliding window use INCR/EXPIRE, token bucket uses a Lua script (tokenBucket.lua) so the refill calculation and decrement happen in a single atomic round trip.

Tech Stack

Backend: Node.js, Express, Redis (via ioredis), MongoDB (via mongoose), dotenv, helmet, cors

Frontend: React (Vite), recharts (traffic charts), axios

Environment: Redis and MongoDB run natively inside WSL (Ubuntu) — no Docker (see Design Decisions)

Project Structure
server/
├── src/
│   ├── env.js                       # loads .env before anything else imports
│   ├── app.js                       # entry point, route wiring
│   ├── config/
│   │   ├── db.js                    # MongoDB connection
│   │   └── redis.js                 # Redis client
│   ├── middleware/
│   │   ├── rateLimiter.js           # dispatcher — static or dynamic (per-key) config
│   │   └── strategies/
│   │       ├── fixedWindow.js
│   │       ├── tokenBucket.js
│   │       ├── tokenBucket.lua      # atomic refill+decrement
│   │       └── slidingWindowCounter.js
│   ├── models/
│   │   ├── ApiKey.js
│   │   └── RequestLog.js
│   ├── routes/
│   │   ├── admin.js                 # key CRUD
│   │   ├── stats.js                 # traffic aggregation for charts
│   │   └── simulate.js              # server-side burst simulator for algorithm comparison
│   └── utils/
│       ├── keyConfigCache.js        # Redis-cached lookup of key config from Mongo
│       └── logQueue.js              # batched async request logging
└── tests/
    ├── concurrency.test.js          # single-instance burst test
    └── distributed.test.js          # multi-instance correctness test

client/
├── src/
│   ├── api/client.js                # axios wrapper for all backend calls
│   └── pages/
│       ├── KeysPage.jsx             # key management + single-key traffic chart
│       ├── TrafficChart.jsx
│       └── ComparePage.jsx          # algorithm comparison view
Setup

Prerequisites: Node.js, WSL2 with Ubuntu, Redis and MongoDB installed inside WSL (no Docker required).

bash
# server
cd server
npm install
npm run dev          # runs on :5000

# client (separate terminal)
cd client
npm install
npm run dev           # runs on :5173

server/.env:

PORT=5000
MONGO_URI=mongodb://localhost:27017/rate_limiter_db
REDIS_URL=redis://localhost:6379
RATE_LIMIT_FAIL_POLICY=open
API Reference

Admin (key management)

Method	Route	Description
POST	/admin/keys	Create a new API key
GET	/admin/keys	List all keys
GET	/admin/keys/:id	Get one key
PATCH	/admin/keys/:id	Update a key's algorithm/limits/active status
DELETE	/admin/keys/:id	Deactivate (soft-delete) a key

Stats

Method	Route	Description
GET	/stats/traffic/:apiKey?minutes=15	Per-minute allowed/rejected counts for a key
GET	/stats/summary	Totals across all keys, last hour

Simulation

Method	Route	Description
POST	/simulate/compare	Runs an identical burst against two keys concurrently, returns per-request timelines for both — powers the algorithm comparison view

Protected route (example)

Method	Route	Description
GET	/api/protected	Rate-limited using the requesting key's own config (dynamic mode)
Design Decisions & Tradeoffs

No Docker. Docker Desktop got stuck during initial setup, so Redis and MongoDB run natively inside WSL2 instead. Windows→WSL localhost forwarding works automatically, no extra networking config needed.

Fail-open vs fail-closed, made configurable. RATE_LIMIT_FAIL_POLICY env var controls what happens if Redis is unreachable at request time:

open (default) — request is allowed through. Prioritizes availability; an infra outage doesn't take down the protected API, at the cost of limits not being enforced during the outage.
closed — request is rejected with 503. Prioritizes strict enforcement, at the cost of the protected route going fully down if Redis goes down.

Both paths are implemented and tested (see Testing & Verification). open is the default because it matches the more common real-world choice for rate limiters — a temporary lapse in enforcement is usually preferable to a full outage.

Async, batched request logging. Every request's outcome is pushed to an in-memory queue and flushed to MongoDB every 5 seconds (or every 200 entries), rather than awaited inline. This keeps Mongo write latency completely off the request hot path — logging is best-effort; a failed batch insert is logged to the console and dropped rather than retried, since losing some analytics data is an acceptable tradeoff for never blocking or crashing the API.

Redis-cached key config, not a Mongo lookup per request. Looking up a key's rate-limit config from Mongo on every single request would add real latency at scale. Instead, keyConfigCache.js checks Redis first (60s TTL), only falling back to Mongo on a cache miss — including a short (10s) negative cache for invalid keys, so a flood of bad-key requests can't hammer Mongo. Admin updates (PATCH/DELETE) explicitly invalidate the cache so config changes apply immediately instead of waiting out the TTL.

Testing & Verification

Single-instance concurrency (tests/concurrency.test.js) — fires 50 truly concurrent requests (via Promise.all) at each algorithm. Confirms Redis atomicity holds under real concurrency on one server instance: fixed window consistently allows exactly limit requests with no race condition slipping extra ones through.

Distributed correctness (tests/distributed.test.js) — two independent server instances (ports 5000 and 5001) sharing one Redis, hit with 50 requests split evenly across both, using a token bucket key (capacity 5). Result: 5 allowed, 45 rejected — matching single-instance capacity exactly, proving Redis (not in-process memory) is genuinely the shared source of truth, and the system would enforce correctly behind a real load balancer with N instances.

Fail-policy verification — tested both open and closed against a guaranteed-unreachable Redis (pointed at a dead port). open returns 200 (request allowed despite the outage); closed returns 503 with a clear error message. See Lessons Learned for a real bug this testing surfaced.

Load Test Results

Tool: autocannon, 50 concurrent connections, 10 second duration, against /api/protected with a high-capacity token bucket key (capacity 10,000, refill 1,000/sec) to measure real throughput rather than the rejection path.

Metric	Value
Avg throughput	~6,639 req/sec (peak ~7,700)
Latency p50	6 ms
Latency p99	21 ms
Total requests	66,000 in 10.04s
Allowed / Rejected	19,978 / 46,410

The allowed/rejected split isn't a bottleneck — it's the rate limiter correctly enforcing its budget under a genuine load-testing hammer: 66,000 requests fired in 10s far exceeds any real client's rate, and the ~19,978 allowed matches the theoretical token budget (capacity + refill × duration ≈ 20,000) almost exactly, confirming the limiter holds its guarantee precisely even at high concurrency.

Known Limitations
Request logging is best-effort (dropped on batch-insert failure, not retried) — acceptable for analytics, not suitable if exact audit-log completeness were a requirement
RequestLog has no automatic expiry/archival — a production deployment would need a TTL index or periodic archival job
No authentication on the /admin routes themselves — anyone who can reach the API can manage keys. A real deployment would put these behind their own auth layer
Single Redis instance — no tested failover/clustering story; the distributed test proves horizontal app-server scaling works, not Redis high-availability
Lessons Learned

ES module import hoisting bug (found during Phase 5 hardening). While testing the fail-open/fail-closed toggle, RATE_LIMIT_FAIL_POLICY=closed was set in .env but requests kept succeeding (200) even with Redis confirmed unreachable — behaving as if the policy were still open.

Root cause: in ES modules, import statements are hoisted and resolved before any other code in the importing file executes — including dotenv.config(). Since rateLimiter.js read process.env.RATE_LIMIT_FAIL_POLICY at module top-level scope, and app.js imported rateLimiter.js before calling dotenv.config(), the policy constant was always evaluated as undefined (silently defaulting to open) regardless of what .env actually specified.

Fixed by adding server/src/env.js (a single-purpose bootstrap that calls dotenv.config()) and importing it as the very first line of app.js, before any other import — guaranteeing environment variables are populated before any other module can read them.

This was a genuinely useful bug to catch during hardening: it's the kind of subtle ordering issue that works fine in casual manual testing (since the "happy path" default of open looked correct) and would only have surfaced in production during a real Redis outage — exactly the moment you'd least want a silent policy failure.