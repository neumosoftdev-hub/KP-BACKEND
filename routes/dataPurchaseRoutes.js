// routes/dataPurchaseRoutes.js
import express from "express";
import { purchaseData } from "../controllers/dataPurchaseController.js";

const router = express.Router();

// POST /api/data/purchase
router.post("/purchase", purchaseData);

export default router;
