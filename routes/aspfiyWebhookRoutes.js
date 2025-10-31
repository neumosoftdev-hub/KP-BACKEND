// routes/aspfiyWebhookRoutes.js
import express from "express";
import { handleAspfiyWebhook } from "../controllers/webhookController.js";

const router = express.Router();

/**
 *  Aspfiy Webhook Route
 *  Handles payment + disbursement notifications from Aspfiy.
 *  POST /api/wallet/webhook/aspfiy
 */
router.post("/aspfiy", express.json({ type: "application/json" }), handleAspfiyWebhook);


/**
 *  Health check for Aspfiy webhook endpoint
 */
router.get("/aspfiy", (req, res) => {
  res.json({ success: true, message: "Aspfiy webhook endpoint active ✅" });
});

export default router;
