import mongoose from "mongoose";
import dotenv from "dotenv";
import CablePlan from "./models/CablePlan.js";

dotenv.config();

const run = async () => {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🧹 Dropping indexes from CablePlan collection...");
    await CablePlan.collection.dropIndexes();
    console.log("✅ All indexes dropped successfully");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected");
  }
};

run();
