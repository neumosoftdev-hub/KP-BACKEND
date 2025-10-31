// routes/index.js
import express from "express";
import authRoutes from "./authRoutes.js";

const router = express.Router();

// Root check route (optional)
router.get("/", (req, res) => {
  res.json({ message: "KwickPay API root is active 🚀" });
});

// Subroutes
router.use("/auth", authRoutes);

export default router;
