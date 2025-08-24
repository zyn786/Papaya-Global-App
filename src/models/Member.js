import mongoose from 'mongoose';
const { Schema } = mongoose;

const MemberSchema = new Schema(
  {
    owner:  { type: String, required: true }, // employee name
    name:   { type: String, required: true },
    workId: { type: String, default: '' },
    group:  { type: String, default: '' },

    opening: { type: Number, default: 0 },
    comm:    { type: Number, default: 10 },   // %
    bonusRateOverride: { type: Number, default: null },

    recv:    { type: Number, default: 0 },
    pay:     { type: Number, default: 0 },
    frozen:  { type: Number, default: 0 },
    runaway: { type: Number, default: 0 },
    charges: { type: Number, default: 0 },
  },
  { timestamps: true }
);

MemberSchema.index({ owner: 1 });
MemberSchema.index({ owner: 1, name: 1 }, { unique: false });

MemberSchema.set('toJSON', {
  virtuals: true, versionKey: false,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; return ret; }
});

export default mongoose.model('Member', MemberSchema);
