import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import crypto from "crypto";

// 🪶 Smart logger for consistent output
const log = (msg, level = "info") => {
  const timestamp = new Date().toISOString();
  console[level](`[Aspfiy][${timestamp}] ${msg}`);
};

/**
 * ASPFIY Webhook Controller
 * ------------------------------------------------------
 * Handles:
 *  - PAYMENT_NOTIFICATION → credits wallet
 *  - DISBURSEMENT_NOTIFICATION → updates txn status
 *  - Verifies signature (MD5(secret_key)) from header x-wiaxy-signature
 *  - Enforces idempotency via unique index on Transaction model
 */
export const handleAspfiyWebhook = async (req, res) => {
  try {
    const event = req.body;
    const signature = req.headers["x-wiaxy-signature"];
    const secret = process.env.ASPFIY_SECRET_KEY;

    // 🧩 Step 1 — Verify webhook signature
    if (secret) {
      const computedSig = crypto.createHash("md5").update(secret).digest("hex");

      if (computedSig !== signature) {
        log(`❌ Invalid signature. Expected ${computedSig}, got ${signature}`, "warn");
        return res.status(403).json({ success: false, message: "Invalid signature" });
      }
    } else {
      log("⚠️ Missing ASPFIY_SECRET_KEY in .env (skipping signature verification)", "warn");
    }

    log(`🔔 Webhook received → ${event.event}`);

    // 🧱 Step 2 — Handle PAYMENT_NOTIFICATION
    if (event.event === "PAYMENT_NOTIFICATION") {
      const { reference, merchant_reference, wiaxy_ref, amount, customer } = event.data || {};

      log(`📦 PAYMENT_NOTIFICATION Payload:
      reference: ${reference}
      merchant_reference: ${merchant_reference}
      wiaxy_ref: ${wiaxy_ref}
      amount: ${amount}
      customer: ${customer?.email || "unknown"}
      `);

      // Basic validation
      if (!reference || !merchant_reference || !wiaxy_ref) {
        log("⚠️ Missing identifiers in PAYMENT_NOTIFICATION", "warn");
        return res.status(400).json({ success: false, message: "Invalid payload" });
      }

      // Find the wallet
      const wallet = await Wallet.findOne({
        "reservedAccount.merchantReference": merchant_reference,
      }).lean();

      if (!wallet) {
        log(`⚠️ Wallet not found for merchantReference: ${merchant_reference}`, "warn");
        return res.status(404).json({ success: false, message: "Wallet not found" });
      }

      // Convert amount safely
      const creditAmount = Number(amount);
      if (Number.isNaN(creditAmount) || creditAmount <= 0) {
        log(`⚠️ Invalid amount: ${amount}`, "warn");
        return res.status(400).json({ success: false, message: "Invalid amount" });
      }

      const txDoc = {
        walletId: wallet._id,
        userId: wallet.userId,
        type: "credit",
        amount: creditAmount,
        reference,
        description: `Aspfiy deposit by ${customer?.email || "unknown user"}`,
        status: "success",
        meta: { merchant_reference, wiaxy_ref, raw: event },
      };

      try {
        // Try inserting the transaction
        const newTx = await Transaction.create(txDoc);

        // Increase wallet balance
        const update = await Wallet.updateOne(
          { _id: wallet._id },
          { $inc: { balance: creditAmount } }
        );

        log(`✅ Wallet credited ₦${creditAmount.toLocaleString()} | Ref: ${reference}`);
        log(`🧾 Transaction ID: ${newTx._id} | Wallet Update: ${update.modifiedCount} doc(s)`);
        return res.status(200).json({ success: true });
      } catch (err) {
        if (err.code === 11000) {
          log(`⚠️ Duplicate transaction ignored (Ref: ${reference})`, "warn");
          return res.status(200).json({ success: true, message: "Duplicate ignored" });
        }

        log(`💥 Transaction creation failed: ${err.message}`, "error");
        return res
          .status(500)
          .json({ success: false, message: "Failed to process transaction" });
      }
    }

    // 🧱 Step 3 — Handle DISBURSEMENT_NOTIFICATION
    if (event.event === "DISBURSEMENT_NOTIFICATION") {
      const { reference, merchant_reference, wiaxy_ref, status } = event.data || {};
      log(`📦 DISBURSEMENT_NOTIFICATION Payload: ref=${reference}, status=${status}`);

      if (!reference || !merchant_reference || !wiaxy_ref) {
        log("⚠️ Missing identifiers in DISBURSEMENT_NOTIFICATION", "warn");
        return res.status(400).json({ success: false, message: "Invalid payload" });
      }

      const txn = await Transaction.findOne({
        reference,
        "meta.merchant_reference": merchant_reference,
        "meta.wiaxy_ref": wiaxy_ref,
      });

      if (!txn) {
        log(`⚠️ Transaction not found for disbursement ref: ${reference}`, "warn");
        return res.status(404).json({ success: false, message: "Transaction not found" });
      }

      txn.status = status === "successful" ? "success" : "failed";
      await txn.save();

      log(`💸 Disbursement updated: ${reference} → ${txn.status.toUpperCase()}`);
      return res.status(200).json({ success: true });
    }

    // 🧱 Step 4 — Handle unknown event
    log(`ℹ️ Unhandled webhook event type: ${event.event}`);
    return res.status(200).json({ success: true, message: "Event ignored" });
  } catch (error) {
    log(`💥 Webhook Error: ${error.message}`, "error");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 🧯 Safety catch for unexpected runtime issues
process.on("unhandledRejection", (err) => {
  log(`💥 Unhandled Rejection: ${err?.message || err}`, "error");
});
process.on("uncaughtException", (err) => {
  log(`💥 Uncaught Exception: ${err?.message || err}`, "error");
});