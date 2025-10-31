// controllers/epinsWebhookController.js
import Transaction from "../models/Transaction.js";
import Wallet from "../models/Wallet.js";

const log = (...args) => console.log("[EPINS WEBHOOK]", ...args);

// If you want HMAC verification later, add EPINS_WEBHOOK_SECRET and raw-body middleware.
const normalize = (payload) => {
  const reference = payload.reference || payload.ref || payload.txn_ref || payload.trxref || payload.transactionReference;
  const status = (payload.status || payload.state || "").toString().toLowerCase();
  return { reference, status, payload };
};

export const handleEpinsWebhook = async (req, res) => {
  try {
    const payload = req.body;
    log("received payload:", payload);

    const { reference, status } = normalize(payload);
    if (!reference) {
      log("missing reference in webhook");
      return res.status(400).json({ success: false, message: "Missing reference" });
    }

    const txn = await Transaction.findOne({ reference, "meta.provider": "epins" });
    if (!txn) {
      log("txn not found for ref:", reference);
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    if (["success", "failed"].includes(txn.status)) {
      // update raw webhook copy and ignore
      txn.meta = { ...(txn.meta || {}), rawWebhook: payload };
      await txn.save();
      log("already finalized:", reference);
      return res.status(200).json({ success: true, message: "Already processed" });
    }

    const successSet = ["success", "successful", "completed", "paid"];
    const failedSet = ["failed", "error", "declined", "rejected", "cancelled"];

    if (successSet.includes(status)) {
      txn.status = "success";
      txn.meta = { ...(txn.meta || {}), rawWebhook: payload };
      await txn.save();
      log("txn marked success:", reference);
      return res.status(200).json({ success: true });
    }

    // treat everything else as failed
    txn.status = "failed";
    txn.meta = { ...(txn.meta || {}), rawWebhook: payload };
    await txn.save();

    // refund once
    if (!txn.refunded) {
      const wallet = await Wallet.findById(txn.walletId);
      if (wallet) {
        const up = await Wallet.updateOne({ _id: wallet._id }, { $inc: { balance: txn.amount } });
        if (up.modifiedCount > 0) {
          txn.refunded = true;
          txn.refundedAt = new Date();
          txn.refundedAmount = txn.amount;
          await txn.save();
          log("refunded", txn.amount, "to", wallet._id);
        } else {
          log("refund modified 0 docs");
        }
      } else {
        log("wallet not found for refund:", txn.walletId);
      }
    }

    return res.status(200).json({ success: true, message: "Marked failed & refunded (if applicable)" });
  } catch (err) {
    console.error("[EPINS WEBHOOK ERROR]", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export default handleEpinsWebhook;
