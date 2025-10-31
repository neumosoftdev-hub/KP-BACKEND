import express from "express";
import { syncDataPlans, getDataPlans, getDataPlanById } from "../controllers/dataPlanController.js";
import { purchaseData } from "../controllers/dataPurchaseController.js";

const router = express.Router();

router.get("/", getDataPlans);
router.get("/:id", getDataPlanById);
router.post("/sync", syncDataPlans);
router.post("/purchase", purchaseData); // ✅ new route

export default router;
