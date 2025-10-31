import express from "express";
import { syncCablePlans } from "../controllers/cablePlanController.js";

const router = express.Router();
router.get("/sync", syncCablePlans);

export default router;
