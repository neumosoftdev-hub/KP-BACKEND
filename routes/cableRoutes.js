import express from "express";
import { verifySmartCard, purchaseCable } from "../controllers/cableController.js";

const router = express.Router();

router.post("/verify", verifySmartCard);
router.post("/purchase", purchaseCable);

export default router;
