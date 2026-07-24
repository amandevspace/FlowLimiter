// server/src/utils/logQueue.js
import RequestLog from '../models/RequestLog.js';

const FLUSH_INTERVAL_MS = 5000;
const FLUSH_BATCH_SIZE = 200;

let queue = [];

/**
 * Non-blocking — just pushes into memory. Never awaited on the request
 * hot path, so a slow Mongo write never adds latency to an API response.
 */
export const queueLog = ({ apiKey, route, algorithm, allowed }) => {
  queue.push({ apiKey, route, algorithm, allowed, timestamp: new Date() });

  if (queue.length >= FLUSH_BATCH_SIZE) {
    flush();
  }
};

const flush = async () => {
  if (queue.length === 0) return;

  const batch = queue;
  queue = [];

  try {
    await RequestLog.insertMany(batch, { ordered: false });
  } catch (err) {
    // Logging is best-effort — never let a logging failure affect the
    // API itself. Just report it and move on; dropped logs are an
    // acceptable tradeoff over blocking or crashing the server.
    console.error('RequestLog batch insert failed:', err.message);
  }
};

/**
 * Call once at server startup (see app.js).
 */
export const startLogFlusher = () => {
  setInterval(flush, FLUSH_INTERVAL_MS);
};

/**
 * Call on graceful shutdown so the last partial batch isn't lost.
 */
export const flushLogsNow = flush;