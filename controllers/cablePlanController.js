import axios from "axios";
import CablePlan from "../models/CablePlan.js";
console.log("CablePlan model type:", typeof CablePlan);

export const syncCablePlans = async (req, res) => {
  try {
    console.log("🚀 Syncing Cable Plans from EPINS (v2)...");

    const BASE_URL = "https://api.epins.com.ng/v2/autho/variations/?service=";
    const API_KEY = process.env.EPINS_API_KEY;

    const providers = ["dstv", "gotv", "startimes"];
    let allPlans = [];

    for (const provider of providers) {
      console.log(`📡 Fetching ${provider.toUpperCase()} plans...`);

      try {
        const { data } = await axios.get(`${BASE_URL}${provider}`, {
          headers: { Authorization: `Bearer ${API_KEY}` },
          timeout: 20000,
        });

        const variations = Array.isArray(data?.description)
          ? data.description.filter(Boolean)
          : [];

        const plans = variations
          .filter((v) => v?.plancode && v?.plan) // 👈 filter out null/invalid ones
          .map((v) => ({
            provider: provider.toUpperCase(),
            name: v.plan.trim(),
            code: v.plancode.trim(),
            amount: Number(v.amount || 0),
            description: v.plan,
            active: true,
          }));

        console.log(`✅ ${provider.toUpperCase()}: ${plans.length} valid plans fetched`);
        allPlans.push(...plans);
      } catch (err) {
        console.error(`⚠️ Failed to fetch ${provider} plans:`, err.response?.data || err.message);
      }
    }

    if (!allPlans.length) {
      return res.status(500).json({
        success: false,
        message: "No cable plans fetched from EPINS — please check API key or response format",
      });
    }

    await CablePlan.deleteMany({});
    await CablePlan.insertMany(allPlans);

    console.log(`✅ Synced total of ${allPlans.length} cable plans successfully`);
    return res.json({
      success: true,
      message: `Synced ${allPlans.length} cable plans successfully`,
      count: allPlans.length,
    });
  } catch (err) {
    console.error("❌ Cable Plan Sync Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to sync cable plans",
      error: err.message,
    });
  }
};
