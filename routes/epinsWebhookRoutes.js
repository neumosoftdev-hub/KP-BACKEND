// routes/epinsWebhookRoutes.js
import express from "express";
import handleEpinsWebhook from "../controllers/epinsWebhookController.js";

const router = express.Router();

// ✅ define the missing function here
function rawBodySaver(req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
}

router.post(
  "/epins",
  express.json({ verify: rawBodySaver, type: "application/json" }),
  handleEpinsWebhook
);

export default router;
