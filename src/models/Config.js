import mongoose from 'mongoose';
const ConfigSchema = new mongoose.Schema({
  currencyCode: { type:String, default:'USD' },
  bonusRate: { type:Number, default:0.04 },     // decimal
  fixedPerTask: { type:Number, default:1 }      // 1 USD per payout by default
},{ timestamps:true });
export default mongoose.model('Config', ConfigSchema);
