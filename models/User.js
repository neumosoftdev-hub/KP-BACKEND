// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true, required: true },
  phone: String,
  state: String,
  password: String,

  aspfiyAccount: {
    accountNumber: String,
    accountName: String,
    bankName: String,
    merchantReference: String,
    aspfiyRef: String,
    createdAt: Date,
  },

  resetOtp: String,
  resetOtpExpires: Date,
  resetVerified: { type: Boolean, default: false },

  transactionPin: String,
  pinOtp: String,
  pinOtpExpires: Date,

  // 👇 Add this to control onboarding stages
  pendingOnboarding: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("User", userSchema);
