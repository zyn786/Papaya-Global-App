// src/models/InviteCode.js
import mongoose from 'mongoose';

const InviteCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  used: { type: Boolean, default: false },
  issuedTo: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('InviteCode', InviteCodeSchema);
