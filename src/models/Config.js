import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    currencyCode: { type: String, default: 'USD' }, // <- used by frontend
    bonusRate: { type: Number, default: 0.04 },
    fixedPerTask: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export default mongoose.model('Config', schema);