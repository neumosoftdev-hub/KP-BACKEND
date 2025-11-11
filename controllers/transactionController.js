// controllers/transactionController.js
import Transaction from "../models/Transaction.js";

export const getUserTransactions = async (req, res) => {
  try {
    const userId = req.user?.id || req.params.userId;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID required" });
    }

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50); // limit for performance

    return res.json({ success: true, transactions });
  } catch (err) {
    console.error("[GET TRANSACTIONS ERROR]", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
      error: err.message,
    });
  }
};
