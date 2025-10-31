import mongoose from "mongoose";

const dataPlanSchema = new mongoose.Schema(
  {
    network: { type: String, required: true }, // e.g., "01" (MTN)
    plan: { type: String, required: true }, // e.g., "1GB (SME) - 30days"
    epincode: { type: String, required: true, unique: true },
    price_api: { type: Number, required: true },

    // ✅ Allow dynamic datatypes — fallback to 'unknown' if new ones appear
    datatype: {
      type: String,
      trim: true,
      default: "unknown",
    },

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("DataPlan", dataPlanSchema);
