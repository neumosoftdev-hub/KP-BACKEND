import mongoose from "mongoose";

const cablePlanSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    name: String,
    code: { type: String, required: true },
    amount: Number,
    description: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("CablePlan", cablePlanSchema);
