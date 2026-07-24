// server/src/routes/admin.js
import express from 'express';
import crypto from 'crypto';
import ApiKey from '../models/ApiKey.js';
import { invalidateKeyConfig } from '../utils/keyConfigCache.js';

const router = express.Router();

const generateKey = () => `ak_${crypto.randomBytes(24).toString('hex')}`;

// Create a new API key
router.post('/keys', async (req, res) => {
  try {
    const {
      owner,
      algorithm = 'fixed_window',
      limit,
      windowSizeInSeconds,
      capacity,
      refillRatePerSec,
    } = req.body;

    if (!owner) {
      return res.status(400).json({ error: 'owner is required' });
    }

    const apiKey = await ApiKey.create({
      key: generateKey(),
      owner,
      algorithm,
      limit,
      windowSizeInSeconds,
      capacity,
      refillRatePerSec,
    });

    res.status(201).json(apiKey);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all keys
router.get('/keys', async (req, res) => {
  try {
    const keys = await ApiKey.find().sort({ createdAt: -1 });
    res.json(keys);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single key
router.get('/keys/:id', async (req, res) => {
  try {
    const key = await ApiKey.findById(req.params.id);
    if (!key) return res.status(404).json({ error: 'Key not found' });
    res.json(key);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a key's config (algorithm, limits, active status, etc.)
router.patch('/keys/:id', async (req, res) => {
  try {
    const key = await ApiKey.findById(req.params.id);
    if (!key) return res.status(404).json({ error: 'Key not found' });

    const allowedFields = [
      'algorithm',
      'limit',
      'windowSizeInSeconds',
      'capacity',
      'refillRatePerSec',
      'active',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        key[field] = req.body[field];
      }
    });

    await key.save();
    await invalidateKeyConfig(key.key); // don't wait out the TTL for changes

    res.json(key);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deactivate (soft-delete) a key
router.delete('/keys/:id', async (req, res) => {
  try {
    const key = await ApiKey.findById(req.params.id);
    if (!key) return res.status(404).json({ error: 'Key not found' });

    key.active = false;
    await key.save();
    await invalidateKeyConfig(key.key);

    res.json({ message: 'Key deactivated', key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;