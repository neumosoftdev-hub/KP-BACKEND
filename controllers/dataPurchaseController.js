// controllers/dataPurchaseController.js
import axios from "axios";
import crypto from "crypto";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";

/**
 * Purchase Data via EPINS API
 * Supports sandbox simulation and live debit/credit flow
 */
export const purchaseData = async (req, res) => {
  try {
    let { networkId, MobileNumber, DataPlan, ref, amount, userId, network, phone, planCode } =
      req.body;

    // 🧩 Allow aliases
    if (!networkId && network) networkId = mapNetworkToId(network);
    if (!MobileNumber && phone) MobileNumber = phone;
    if (!DataPlan && planCode) DataPlan = planCode;

    // ✅ Auto-generate unique ref if not provided
    if (!ref) {
      const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
      const shortTime = Date.now().toString().slice(-6);
      ref = `EP${shortTime}${rand}`; // Example: EP654321AB12
    }

    // ⚠️ Validation
    if (!networkId || !MobileNumber || !DataPlan || !ref) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: networkId, MobileNumber, DataPlan, or ref",
      });
    }

    // ⚙️ Mode setup
    const mode = (process.env.EPINS_MODE || "sandbox").toLowerCase();
    const simulateWalletFlow = mode === "live" || mode === "sandbox";

    console.log(`🚀 [${mode.toUpperCase()} MODE] Purchasing data — ref: ${ref}`);

    // 💰 Wallet management (simulate for sandbox + live)
    let wallet = null;
    if (simulateWalletFlow) {
      wallet = await Wallet.findOne({ userId });
      if (!wallet)
        return res.status(404).json({ success: false, message: "Wallet not found for this user" });

      if (amount && wallet.balance < amount)
        return res.status(400).json({ success: false, message: "Insufficient wallet balance" });

      if (amount) {
        // Deduct temporarily
        wallet.balance -= amount;
        wallet.transactions.push({
          type: "debit",
          amount,
          reference: ref,
          description: `Pending data purchase (${networkId}) to ${MobileNumber}`,
          status: "pending",
        });
        await wallet.save();

        // 🔔 Emit wallet update (pending)
        if (global.io) {
          global.io.emit("walletUpdated", {
            userId,
            balance: wallet.balance,
            status: "pending",
            reference: ref,
            message: `Pending data purchase of ₦${amount} to ${MobileNumber}`,
          });
        }
      }
    }

    // 📡 Perform data purchase through EPINS API
    const data = await purchaseDataFromEpins({
      networkId,
      MobileNumber,
      DataPlan,
      ref,
      mode,
    });

    // 🧩 Parse EPINS response
    const providerRef =
      data?.transref ||
      data?.response?.description?.ref ||
      data?.description?.ref ||
      ref;

    const messageText =
      data?.message ||
      data?.response?.description?.response_description ||
      data?.description ||
      "";

    const isSuccess =
      data?.response?.code === 101 ||
      data?.code === 101 ||
      data?.success === true ||
      data?.status === true ||
      /successful|gifted|sent|completed|thank/i.test(messageText);

    console.log("🔍 EPINS RESPONSE:", JSON.stringify(data).slice(0, 600), "\n✅ Success?", isSuccess);

    // 🧾 Create Transaction Record
    const tx = await Transaction.create({
      userId,
      walletId: wallet?._id || null,
      type: "debit",
      amount: amount || 0,
      reference: ref,
      description: `Data purchase (${networkId}) to ${MobileNumber}`,
      status: isSuccess ? "success" : "failed",
      meta: {
        provider: "epins",
        providerService: "data",
        providerRef,
        rawWebhook: data,
        mode,
      },
    });

    // 🔁 Update wallet transaction or refund on failure
    if (wallet) {
      const idx = wallet.transactions.findIndex((t) => t.reference === ref);
      if (idx !== -1) {
        wallet.transactions[idx].status = isSuccess ? "success" : "failed";
        wallet.transactions[idx].description = `Data purchase (${networkId}) to ${MobileNumber}`;
        wallet.transactions[idx].meta = { provider: "epins", providerRef };
      }

      // Refund failed transactions
      if (!isSuccess && amount) wallet.balance += amount;
      await wallet.save();

      // 🔔 Emit wallet update after transaction
      if (global.io) {
        global.io.emit("walletUpdated", {
          userId,
          balance: wallet.balance,
          status: isSuccess ? "success" : "failed",
          reference: ref,
          message: isSuccess
            ? `Data purchase successful for ${MobileNumber}`
            : `Data purchase failed for ${MobileNumber}. Refund processed.`,
        });
      }
    }

    // ❌ Handle failed purchases (live only)
    if (!isSuccess && mode === "live") {
      return res.status(400).json({
        success: false,
        message: data?.message || "Data purchase failed",
        response: data,
      });
    }

    // ✅ Success response
    return res.json({
      success: true,
      mode,
      ref,
      message:
        data?.message ||
        (mode === "sandbox"
          ? "Sandbox data purchase simulated successfully"
          : "Data purchase successful"),
      transref: providerRef,
      response: data,
      txId: tx._id,
    });
  } catch (err) {
    console.error("❌ Data purchase error:", err.message);
    if (err.response) console.error("📨 EPINS ERROR BODY:", err.response.data);
    res.status(500).json({ success: false, error: err.message });
  }
};

// 🔧 Helper to call EPINS API safely
async function purchaseDataFromEpins({ networkId, MobileNumber, DataPlan, ref, mode }) {
  try {
    const baseUrl =
      (mode === "live"
        ? process.env.EPINS_BASE_URL || "https://api.epins.com.ng/v3/autho"
        : process.env.EPINS_BASE_URL_SANDBOX || "https://api.epins.com.ng/sandbox"
      ).replace(/\/$/, "");

    const apiKey =
      mode === "live"
        ? process.env.EPINS_API_KEY
        : process.env.EPINS_API_KEY_SANDBOX || "D2RYoiH5icRgsQB9vpXlLNRQgeAW7MYRB3WE6RvfxXC46Sr7hH";

    const timeout = Number(process.env.EPINS_TIMEOUT_MS) || 20000;

    const response = await axios.post(
      `${baseUrl}/data/`,
      { networkId, MobileNumber, DataPlan, ref },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout,
      }
    );

    return response.data;
  } catch (err) {
    console.error("[EPINS DATA ERROR]", err.response?.data || err.message);
    return {
      success: false,
      message:
        err.response?.data?.description ||
        err.message ||
        "Failed to purchase data",
    };
  }
}

// 🔄 Network ID Mapper
function mapNetworkToId(network) {
  const map = { mtn: "01", glo: "02", "9mobile": "03", etisalat: "03", airtel: "04" };
  return map[network?.toLowerCase()] || null;
}
