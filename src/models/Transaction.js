import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

const TransactionSchema = new Schema(
  {
    // Relations / denormalized fields for easy UI rendering
    memberId: { type: Types.ObjectId, ref: 'Member', required: true },

    owner:   { type: String, required: true },   // receptionist / employee name
    member:  { type: String, default: '' },      // member name (denormalized)
    group:   { type: String, default: '' },      // work group name (denormalized)
    workId:  { type: String, default: '' },      // member working ID (denormalized)

    // Transaction data
    type: {
      type: String,
      required: true,
      enum: ['Fiat Convert', 'Payout', 'USDT Top Up', 'Frozen', 'Runaway'],
    },
    amount:        { type: Number, default: 0 },
    fee:           { type: Number, default: 0 },
    note:          { type: String, default: '' },

    // Optional extras
    bonusRate:     { type: Number, default: null }, // e.g., 0.04 for 4%
    cryptoAddress: { type: String, default: null },
    bankDetails:   { type: String, default: null },

    // Report sorting
    dateISO: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true }
);

// Helpful indexes
TransactionSchema.index({ owner: 1, createdAt: -1 });
TransactionSchema.index({ memberId: 1, createdAt: -1 });
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ owner: 'text', member: 'text', type: 'text', note: 'text' });

TransactionSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export default mongoose.model('Transaction', TransactionSchema);
