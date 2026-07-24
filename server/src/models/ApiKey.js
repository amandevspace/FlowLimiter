// server/src/models/ApiKey.js
import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    owner: {
      type: String,
      required: true,
      trim: true,
    },
    algorithm: {
      type: String,
      enum: ['fixed_window', 'token_bucket', 'sliding_window_counter'],
      default: 'fixed_window',
    },
    limit: {
      type: Number,
      default: 100,
    },
    windowSizeInSeconds: {
      type: Number,
      default: 60,
    },
    capacity: {
      type: Number,
      default: 100,
    },
    refillRatePerSec: {
      type: Number,
      default: 1,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('ApiKey', apiKeySchema);