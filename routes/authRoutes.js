import express from "express";
import {
  register,
  verifyOtp,
  login,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  sendPinResetOtp,
  verifyPinResetOtp,
  setTransactionPin,
  resetTransactionPin,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js"; // ✅ add this
import { getProfile } from "../controllers/authController.js";
import { verifyTransactionPin} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);

// Protected routes
router.post("/set-transaction-pin", authMiddleware, setTransactionPin);
router.post("/send-pin-otp", authMiddleware, sendPinResetOtp); //for reset in app
router.post("/verify-pin-otp", authMiddleware, verifyPinResetOtp); // verify reset otp
router.post("/reset-transaction-pin", authMiddleware, resetTransactionPin); //finally reset the transacrtion pin
router.post("/verify-transaction-pin", authMiddleware, verifyTransactionPin);
router.get("/profile", authMiddleware, getProfile);

export default router;