// controllers/cableController.js
import epinsCableService from "../services/epinsCableService.js";
import Transaction from "../models/Transaction.js";
import Wallet from "../models/Wallet.js";

// Generate unique transaction reference (max 17 chars)
function generateReference(prefix = "CAB") {
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  const shortTime = Date.now().toString().slice(-6);
  return `${prefix}${shortTime}${rand}`.slice(0, 17);
}

// Determine environment
const MODE = process.env.EPINS_MODE?.toLowerCase() || "live";
const isSandbox = MODE === "sandbox";
const TIMEOUT_MS = Number(process.env.EPINS_TIMEOUT_MS) || 15000;

/**
 * ✅ Verify Smartcard
 */
export const verifySmartCard = async (req, res) => {
  try {
    const { serviceId, billerNumber, vcode } = req.body;

    if (!serviceId || !billerNumber || !vcode) {
      return res.status(400).json({ success: false, message: "Missing required parameters" });
    }

    const result = await epinsCableService.validateSmartcard({ serviceId, billerNumber, vcode });

    if (result.status === "success") {
      return res.status(200).json({ success: true, data: result.data });
    }

    return res.status(400).json({
      success: false,
      message: result.message || "Validation failed",
      details: result.data || null,
    });
  } catch (err) {
    console.error("verifySmartCard error:", err);
    return res.status(500).json({
      success: false,
      message: "Smartcard verification failed",
      details: err?.message || err,
    });
  }
};

/**
 * 💳 Purchase Cable Subscription (with Socket.IO Events)
 */
export const purchaseCable = async (req, res) => {
  try {
    const { userId, service, accountno, vcode, amount } = req.body;

    if (!userId || !service || !accountno || !vcode || !amount) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Wallet not found for this user" });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    const reference = generateReference("CAB");
    console.log("Generated reference:", reference);

    const exists = await Transaction.findOne({ reference });
    if (exists) {
      return res.status(409).json({ success: false, message: "Reference collision, try again" });
    }

    const transaction = await Transaction.create({
      walletId: wallet._id,
      userId,
      type: "debit",
      amount,
      reference,
      description: `${service.toUpperCase()} subscription for ${accountno}`,
      status: "pending",
      meta: { provider: "Epins", providerService: service },
    });

    // 🔹 Emit pending transaction event
    if (global.io) {
      global.io.emit("transactionUpdate", {
        type: "cable",
        status: "pending",
        ref: reference,
        accountno,
        amount,
        service,
        message: `${service.toUpperCase()} subscription initialized`,
      });
    }

    if (isSandbox) {
      console.log("Running in sandbox mode — no wallet deduction will occur.");
    }

    const payload = {
      service: String(service),
      accountno: String(accountno),
      vcode: String(vcode),
      amount: Number(amount),
      ref: String(reference),
    };

    console.log("Calling epins recharge with payload:", payload);

    const providerResult = await epinsCableService.recharge(payload);

    // ✅ Provider success
    if (providerResult.status === "success" && providerResult.code === 101) {
      if (!isSandbox) {
        wallet.balance -= amount;
        await wallet.save();
      } else {
        transaction.meta.note = "sandbox - no wallet deduction";
      }

      transaction.status = "success";
      transaction.meta.providerRef = providerResult.data?.description?.ref || null;
      transaction.meta.providerResponse = providerResult.data || providerResult;
      await transaction.save();

      console.log(`[CABLE SUCCESS] ${service} | ${accountno} | ₦${amount}`);

      if (global.io) {
        global.io.emit("transactionUpdate", {
          type: "cable",
          status: "success",
          ref: reference,
          accountno,
          amount,
          service,
          message: `${service.toUpperCase()} subscription successful`,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Cable subscription processed",
        sandbox: isSandbox,
        transaction,
        providerResponse: providerResult.data || providerResult,
      });
    }

    // ⚠️ Provider uncertain — recheck status
    console.warn("Provider returned non-101 code:", providerResult);
    let statusCheck = null;
    try {
      statusCheck = await epinsCableService.checkTransactionStatus(reference);
    } catch (err) {
      console.error("Error checking transaction status:", err);
    }

    if (statusCheck?.status === "success" && (statusCheck.code === 101 || statusCheck.data?.code === 101)) {
      if (!isSandbox) {
        wallet.balance -= amount;
        await wallet.save();
      } else {
        transaction.meta.note = "sandbox - no wallet deduction";
      }

      transaction.status = "success";
      transaction.meta.providerRef = statusCheck.data?.description?.ref || null;
      transaction.meta.providerResponse = statusCheck.data || providerResult;
      await transaction.save();

      if (global.io) {
        global.io.emit("transactionUpdate", {
          type: "cable",
          status: "success",
          ref: reference,
          accountno,
          amount,
          service,
          message: `${service.toUpperCase()} subscription successful (after recheck)`,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Cable subscription processed (status confirmed via transaction-status)",
        sandbox: isSandbox,
        transaction,
        providerResponse: statusCheck.data || providerResult,
      });
    }

    // ⏳ If still pending
    if (statusCheck?.status === "success" && (statusCheck.data?.status === "pending" || statusCheck.code === 102)) {
      transaction.status = "pending";
      transaction.meta.providerResponse = statusCheck.data || providerResult;
      await transaction.save();

      if (global.io) {
        global.io.emit("transactionUpdate", {
          type: "cable",
          status: "pending",
          ref: reference,
          accountno,
          amount,
          service,
          message: `${service.toUpperCase()} subscription is pending confirmation`,
        });
      }

      return res.status(202).json({
        success: false,
        message: "Transaction is pending. We will update when provider confirms.",
        transaction,
        providerResponse: statusCheck.data || providerResult,
      });
    }

    // 🛑 Otherwise mark failed
    transaction.status = "failed";
    transaction.meta.providerResponse = providerResult.data || providerResult;
    await transaction.save();

    console.error(`[CABLE FAILED] ${service} | ${accountno} | ₦${amount}`);

    if (global.io) {
      global.io.emit("transactionUpdate", {
        type: "cable",
        status: "failed",
        ref: reference,
        accountno,
        amount,
        service,
        message: `${service.toUpperCase()} subscription failed`,
      });
    }

    const failureMessage = providerResult.message || providerResult.data || "Recharge failed";
    return res.status(400).json({
      success: false,
      message: failureMessage,
      transaction,
      providerResponse: providerResult.data || providerResult,
    });
  } catch (err) {
    console.error("purchaseCable unexpected error:", err);

    try {
      if (typeof transaction !== "undefined" && transaction) {
        transaction.status = "pending";
        transaction.meta.error = err?.message || String(err);
        await transaction.save();

        if (global.io) {
          global.io.emit("transactionUpdate", {
            type: "cable",
            status: "pending",
            ref: transaction.reference,
            accountno: transaction.meta.accountno,
            amount: transaction.amount,
            service: transaction.meta.providerService,
            message: `${transaction.meta.providerService.toUpperCase()} transaction encountered a server issue`,
          });
        }
      }
    } catch (saveErr) {
      console.error("Error updating transaction after exception:", saveErr);
    }

    return res.status(500).json({
      success: false,
      message: "Cable purchase failed due to server error",
      details: err?.message || err,
    });
  }
};
