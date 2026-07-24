// server/src/models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'viewer'],
      default: 'admin',
    },
    lastLoginAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
