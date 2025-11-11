import express from "express";
import { getUserTransactions } from "../controllers/transactionController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// 👇 Protected route — user must be logged in
router.get("/me", authMiddleware, getUserTransactions);

export default router;
