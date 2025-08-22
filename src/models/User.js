import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type:String, required:true },
  email: { type:String, required:true, unique:true, index:true },
  passHash: { type:String, required:true },
  role: { type:String, enum:['Admin','Employee'], default:'Employee', index:true }
},{ timestamps:true });

export default mongoose.model('User', UserSchema);
