import mongoose from 'mongoose';
const EmployeeSchema = new mongoose.Schema({
  name: { type:String, required:true, index:true },
  email: { type:String },
  status: { type:String, enum:['Active','Inactive'], default:'Active' }
},{ timestamps:true });
export default mongoose.model('Employee', EmployeeSchema);
