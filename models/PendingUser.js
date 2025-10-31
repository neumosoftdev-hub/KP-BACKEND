// models/PendingUser.js
import mongoose from 'mongoose';

const pendingUserSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  email:     { type: String, required: true, index: true },
  phone:     { type: String, required: true, index: true },
  state:     { type: String, required: true },
  password:  { type: String, required: true },
  otp:       { type: String, required: true },
  otpExpires:{ 
    type: Date,
    required: true,
    // TTL index: document will be removed when otpExpires <= now
    expires: 0
  },
}, {
  timestamps: true
});

export default mongoose.model('PendingUser', pendingUserSchema);
