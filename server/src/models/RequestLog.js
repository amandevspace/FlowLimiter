// server/src/models/RequestLog.js
import mongoose from 'mongoose';

const requestLogSchema = new mongoose.Schema({
  apiKey: {
    type: String,
    required: true,
    index: true,
  },
  route: {
    type: String,
    required: true,
  },
  algorithm: {
    type: String,
  },
  allowed: {
    type: Boolean,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

requestLogSchema.index({ apiKey: 1, timestamp: -1 });

export default mongoose.model('RequestLog', requestLogSchema);