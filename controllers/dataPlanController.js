// controllers/dataPlanController.js
import axios from "axios";
import DataPlan from "../models/dataPlanModel.js";

/**
 * @desc    Sync data plans from EPINS API (secured)
 * @route   POST /api/data-plans/sync
 */
export const syncDataPlans = async (req, res) => {
  try {
    const EPINS_API_KEY = process.env.EPINS_API_KEY;
    const url = "https://api.epins.com.ng/v2/autho/variations/?service=data";

    // 🔐 Security: Verify Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Missing or invalid Authorization header",
      });
    }

    const providedKey = authHeader.split(" ")[1];
    if (providedKey !== EPINS_API_KEY) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Invalid EPINS API key",
      });
    }

    // 🌐 Fetch from EPINS API
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${EPINS_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: process.env.EPINS_TIMEOUT_MS || 20000,
    });

    const { description } = response.data;
    if (!Array.isArray(description)) {
      return res.status(400).json({
        success: false,
        message: "Invalid EPINS response format",
      });
    }

    let inserted = 0;
    let updated = 0;

    for (const plan of description) {
      const existing = await DataPlan.findOne({ epincode: plan.epincode });

      if (existing) {
        await DataPlan.updateOne({ epincode: plan.epincode }, plan);
        updated++;
      } else {
        await DataPlan.create(plan);
        inserted++;
      }
    }

    res.json({
      success: true,
      message: "✅ Sync completed successfully",
      total: description.length,
      inserted,
      updated,
    });
  } catch (err) {
    console.error("❌ Sync error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * @desc    Get all data plans (filterable, grouped, and frontend-ready)
 * @route   GET /api/data-plans
 */
export const getDataPlans = async (req, res) => {
  try {
    const { network, datatype, grouped } = req.query;

    const query = {};
    if (network) query.network = network;
    if (datatype) query.datatype = datatype;

    const plans = await DataPlan.find(query).sort({ network: 1, price_api: 1 });

    // 🧠 Format for frontend
    const formattedPlans = plans.map((plan) => ({
      id: plan._id,
      network: plan.network_name || plan.network || "Unknown",
      datatype: plan.datatype,
      plan_name: plan.plan_name || plan.plan || "Unnamed Plan",
      price: Number(plan.price_api).toFixed(2),
      validity: plan.validity || plan.duration || "N/A",
      code: plan.epincode,
      description: plan.description || `${plan.network_name} ${plan.plan_name}`,
      available: plan.status !== false,
    }));

    // 🧩 If grouped requested (for dropdown menus)
    if (grouped === "true") {
      const groupedPlans = formattedPlans.reduce((acc, plan) => {
        if (!acc[plan.network]) acc[plan.network] = [];
        acc[plan.network].push(plan);
        return acc;
      }, {});
      return res.json({ success: true, data: groupedPlans });
    }

    res.json({ success: true, count: formattedPlans.length, data: formattedPlans });
  } catch (err) {
    console.error("❌ Fetch error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * @desc    Get single data plan (frontend-ready)
 * @route   GET /api/data-plans/:id
 */
export const getDataPlanById = async (req, res) => {
  try {
    const plan = await DataPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    const formatted = {
      id: plan._id,
      network: plan.network_name || plan.network,
      datatype: plan.datatype,
      plan_name: plan.plan_name || plan.plan,
      price: Number(plan.price_api).toFixed(2),
      validity: plan.validity || plan.duration || "N/A",
      code: plan.epincode,
      description: plan.description || `${plan.network_name} ${plan.plan_name}`,
      available: plan.status !== false,
    };

    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error("❌ Fetch single plan error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
