// routes/airtimeRoutes.js
import express from "express";
import { getAirtimeBalance, purchaseAirtime } from "../controllers/airtimeController.js";

const router = express.Router();

// ✅ Routes
router.get("/balance", getAirtimeBalance);
router.post("/purchase", purchaseAirtime);

export default router;
