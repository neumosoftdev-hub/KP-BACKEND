// controllers/electricityController.js
import electricityService from "../services/electricityService.js";
import Transaction from "../models/Transaction.js";
import Wallet from "../models/Wallet.js";

/* -------------------------------------------------------------------------- */
/* 🔹 Generate unique 17-character reference (e.g., ELEC9832730012)           */
/* -------------------------------------------------------------------------- */
function generateReference(prefix = "ELEC") {
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  const shortTime = Date.now().toString().slice(-6);
  return `${prefix}${shortTime}${rand}`.slice(0, 17);
}

/* -------------------------------------------------------------------------- */
/* 🔹 Environment mode                                                        */
/* -------------------------------------------------------------------------- */
const MODE = process.env.EPINS_MODE?.toLowerCase() || "live";
const isSandbox = MODE === "sandbox";

/* -------------------------------------------------------------------------- */
/* 🔹 Unified helper to check provider success                                */
/* -------------------------------------------------------------------------- */
const isProviderSuccess = (result) => {
  // normalize number code if string
  const code = Number(result?.code);
  const status = result?.status?.toString()?.toLowerCase();

  return [101, 119].includes(code) || status === "success";
};

/* -------------------------------------------------------------------------- */
/* ✅ Validate Electricity Meter Number                                       */
/* -------------------------------------------------------------------------- */
export const validateMeter = async (req, res) => {
  try {
    const { serviceId, billerNumber, vcode } = req.body;

    if (!serviceId || !billerNumber || !vcode) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    const result = await electricityService.validateMeter({
      serviceId,
      billerNumber,
      vcode,
    });

    console.log("🔍 validateMeter response:", result);

    // ✅ fix: treat code 101 or 119 as success even if no "status"
    if (isProviderSuccess(result)) {
      return res.status(200).json({
        success: true,
        message: "Meter validated successfully",
        data: result?.description || result?.data || result,
      });
    }

    // ❌ Fallback failed case
    return res.status(400).json({
      success: false,
      message:
        result?.message ||
        result?.responseMessage ||
        "Meter validation failed",
      details: result?.description || result?.data || result || null,
    });
  } catch (err) {
    console.error("❌ validateMeter error:", err);
    return res.status(500).json({
      success: false,
      message: "Validation failed due to server error",
      details: err.message,
    });
  }
};

/* -------------------------------------------------------------------------- */
/* ⚡ Purchase Electricity Token                                              */
/* -------------------------------------------------------------------------- */
export const purchaseElectricity = async (req, res) => {
  try {
    const { userId, service, accountno, vcode, amount } = req.body;
    const activeUserId = req.user?._id || userId;

    if (!activeUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    if (!service || !accountno || !vcode || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // 🔹 Find user wallet
    const wallet = await Wallet.findOne({ userId: activeUserId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found for this user",
      });
    }

    // 🔹 Check balance
    if (!isSandbox && wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    // 🔹 Create reference
    const reference = generateReference("ELEC");

    // 🔹 Log transaction
    const transaction = await Transaction.create({
      walletId: wallet._id,
      userId: activeUserId,
      type: "debit",
      amount,
      reference,
      description: `${service.toUpperCase()} electricity payment for ${accountno}`,
      status: "pending",
      meta: { provider: "Epins", providerService: service },
    });

    // 💰 Deduct temporarily (sandbox or live)
    if (!isSandbox) {
      wallet.balance -= amount;
      await wallet.save();
    } else {
      transaction.meta.note = "sandbox - no wallet deduction";
    }

    // 🔔 Emit pending update
    if (global.io) {
      global.io.emit("walletUpdated", {
        userId: activeUserId,
        balance: wallet.balance,
        status: "pending",
        reference,
        message: `Pending electricity payment of ₦${amount} for ${accountno}`,
      });
    }

    // 🔹 Prepare payload for Epins API
    const payload = {
      service: String(service),
      accountno: String(accountno),
      vcode: String(vcode),
      amount: Number(amount),
      ref: String(reference),
    };

    const providerResult = await electricityService.purchase(payload);

    console.log("🔌 purchaseElectricity response:", providerResult);

    // 🔹 Handle provider success
    const isSuccess = isProviderSuccess(providerResult);

    if (isSuccess) {
      transaction.status = "success";
      transaction.meta.providerResponse =
        providerResult?.description || providerResult?.data;
      await transaction.save();

      // 🔔 Emit success update
      if (global.io) {
        global.io.emit("walletUpdated", {
          userId: activeUserId,
          balance: wallet.balance,
          status: "success",
          reference,
          message: `Electricity token purchased successfully for ${accountno}`,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Electricity token purchased successfully",
        sandbox: isSandbox,
        transaction,
        providerResponse:
          providerResult?.description || providerResult?.data || providerResult,
      });
    }

    // 🔹 Handle failure (refund if applicable)
    if (!isSandbox) {
      wallet.balance += amount; // Refund
      await wallet.save();
    }

    transaction.status = "failed";
    transaction.meta.providerResponse =
      providerResult?.data || providerResult?.description || providerResult;
    await transaction.save();

    // 🔔 Emit failed update
    if (global.io) {
      global.io.emit("walletUpdated", {
        userId: activeUserId,
        balance: wallet.balance,
        status: "failed",
        reference,
        message: `Electricity purchase failed for ${accountno}. Refund processed.`,
      });
    }

    return res.status(400).json({
      success: false,
      message: providerResult?.message || "Electricity purchase failed",
      transaction,
      providerResponse:
        providerResult?.data || providerResult?.description || providerResult,
    });
  } catch (err) {
    console.error("⚡ purchaseElectricity error:", err);
    return res.status(500).json({
      success: false,
      message: "Electricity purchase failed due to server error",
      details: err.message,
    });
  }
};
