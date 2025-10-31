// models/Transaction.js
import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", required: false },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },

    type: { type: String, enum: ["debit", "credit"], required: true },
    amount: { type: Number, required: true },
    reference: { type: String, required: true },
    description: { type: String },

    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
      required: true,
    },

    meta: {
      provider: { type: String },
      providerService: { type: String },
      providerRef: { type: String },
      rawWebhook: { type: Object, default: null },
      extra: { type: Object, default: null },
    },

    refunded: { type: Boolean, default: false },
    refundedAt: { type: Date, default: null },
    refundedAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

transactionSchema.index({ reference: 1, "meta.provider": 1 }, { unique: true, sparse: true });
transactionSchema.index({ walletId: 1 });
transactionSchema.index({ userId: 1 });
transactionSchema.index({ "meta.providerRef": 1 });

export default mongoose.model("Transaction", transactionSchema);
