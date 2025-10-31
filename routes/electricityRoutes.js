// routes/electricityRoutes.js
import express from "express";
import { validateMeter, purchaseElectricity } from "../controllers/electricityController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// 🧾 Validate meter number
router.post("/validate", authMiddleware, validateMeter);

// ⚡ Purchase electricity token
router.post("/purchase", authMiddleware, purchaseElectricity);

export default router;
