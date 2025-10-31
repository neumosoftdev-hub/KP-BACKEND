// models/Wallet.js
import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["credit", "debit"], required: true },
    amount: { type: Number, required: true },
    reference: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "success",
    },
    meta: {
      merchant_reference: { type: String },
      wiaxy_ref: { type: String },
      raw: { type: Object, default: null },
    },
  },
  { timestamps: true }
);

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // ❌ Removed `index: true` (we’ll handle it below with schema.index)
    },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: "NGN" },
    reservedAccount: {
      accountNumber: { type: String },
      accountName: { type: String },
      bankName: { type: String },
      merchantReference: { type: String },
      // ❌ Removed `index: true` — handled below
    },
    transactions: [transactionSchema],
  },
  { timestamps: true }
);

// ⚙️ Index definitions
walletSchema.index({ userId: 1 });
walletSchema.index({ "reservedAccount.merchantReference": 1 });

// Prevent duplicate transaction references for a user
walletSchema.index({ userId: 1, "transactions.reference": 1 });

// Prevent duplicate transactions across three keys
walletSchema.index(
  {
    "transactions.reference": 1,
    "transactions.meta.merchant_reference": 1,
    "transactions.meta.wiaxy_ref": 1,
  },
  { unique: true, sparse: true, name: "unique_tx_ref_merchant_wiaxy" }
);

// 🕒 Keep updatedAt fresh
walletSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("Wallet", walletSchema);
