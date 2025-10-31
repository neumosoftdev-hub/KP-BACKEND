// controllers/airtimeController.js
import epinsService from "../services/epinsService.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import crypto from "crypto";

/**
 * ✅ Fetch EPINS Airtime Balance
 */
export const getAirtimeBalance = async (req, res) => {
  try {
    const data = await epinsService.getBalance();
    return res.json({ success: true, data });
  } catch (err) {
    console.error("[EPINS BALANCE ERROR]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch EPINS balance",
      error: err.message,
    });
  }
};

/**
 * 💳 Purchase Airtime (EPINS Integration + Socket.IO Events)
 */
export const purchaseAirtime = async (req, res) => {
  try {
    const { userId, network, phone, amount } = req.body;
    let { ref } = req.body;

    if (!network || !phone || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: network, phone, or amount",
      });
    }

    // ✅ Generate short ref (max 17 chars)
    if (!ref) {
      const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
      const shortTime = Date.now().toString().slice(-6);
      ref = `EP${shortTime}${rand}`;
    }

    const numericAmount = Number(amount);

    // ✅ Find wallet (user or company)
    const wallet = userId
      ? await Wallet.findOne({ userId })
      : await Wallet.findOne({ isCompanyWallet: true });

    if (!wallet) {
      return res.status(404).json({ success: false, message: "Wallet not found" });
    }

    if (wallet.balance < numericAmount) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    // ✅ Create transaction record (pending)
    const txn = await Transaction.create({
      userId: userId || null,
      walletId: wallet._id,
      type: "debit",
      amount: numericAmount,
      reference: ref,
      description: `Airtime purchase for ${phone}`,
      meta: { provider: "epins", providerService: "airtime", network, phone },
      status: "pending",
    });

    // 🔹 Emit socket event: pending
    if (global.io) {
      global.io.emit("transactionUpdate", {
        type: "airtime",
        status: "pending",
        ref,
        phone,
        amount: numericAmount,
        message: "Airtime transaction initialized",
      });
    }

    const payload = { network, phone, amount: numericAmount, ref, request_id: ref };

    let response;
    try {
      // 🔹 Step 1: Attempt direct airtime purchase
      response = await epinsService.purchaseAirtime(payload);

      // ✅ Step 2: If EPINS confirms success
      if (response?.status === "success" || response?.code === 101) {
        await Wallet.updateOne({ _id: wallet._id }, { $inc: { balance: -numericAmount } });
        txn.status = "success";
        txn.meta.providerRef = response.reference || ref;
        await txn.save();

        console.log(`[AIRTIME SUCCESS] ${network} | ${phone} | ₦${numericAmount}`);

        if (global.io) {
          global.io.emit("transactionUpdate", {
            type: "airtime",
            status: "success",
            ref,
            phone,
            amount: numericAmount,
            message: "Airtime purchase successful",
          });
        }

        return res.json({
          success: true,
          message: "Airtime purchase successful",
          transaction: txn,
          providerResponse: response,
        });
      }

      // ⚠️ Step 3: If uncertain, recheck status
      console.warn("[EPINS UNCERTAIN RESPONSE]", response);
      const statusCheck = await epinsService.checkAirtimeStatus(ref);

      if (statusCheck?.status === "success" || statusCheck?.code === 101) {
        await Wallet.updateOne({ _id: wallet._id }, { $inc: { balance: -numericAmount } });
        txn.status = "success";
        txn.meta.providerRef = statusCheck.reference || ref;
        await txn.save();

        console.log(`[AIRTIME SUCCESS AFTER RECHECK] ${network} | ${phone}`);

        if (global.io) {
          global.io.emit("transactionUpdate", {
            type: "airtime",
            status: "success",
            ref,
            phone,
            amount: numericAmount,
            message: "Airtime purchase successful after recheck",
          });
        }

        return res.json({
          success: true,
          message: "Airtime purchase successful (after status recheck)",
          transaction: txn,
          providerResponse: statusCheck,
        });
      }

      // 🛑 Step 4: Failure confirmed
      txn.status = "failed";
      txn.meta.reason = response?.description || "EPINS failed to deliver";
      await txn.save();

      console.error("[AIRTIME FAILED]", response);

      if (global.io) {
        global.io.emit("transactionUpdate", {
          type: "airtime",
          status: "failed",
          ref,
          phone,
          amount: numericAmount,
          message: "Airtime purchase failed",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Airtime purchase failed",
        providerResponse: response,
      });
    } catch (error) {
      // ⏳ Handle timeout/network failure
      if (error.code === "ECONNABORTED") {
        console.warn("[EPINS TIMEOUT] Retrying status check...");
        const statusCheck = await epinsService.checkAirtimeStatus(ref);

        if (statusCheck?.status === "success" || statusCheck?.code === 101) {
          await Wallet.updateOne({ _id: wallet._id }, { $inc: { balance: -numericAmount } });
          txn.status = "success";
          txn.meta.providerRef = statusCheck.reference || ref;
          await txn.save();

          if (global.io) {
            global.io.emit("transactionUpdate", {
              type: "airtime",
              status: "success",
              ref,
              phone,
              amount: numericAmount,
              message: "Airtime delivered after timeout",
            });
          }

          return res.status(200).json({
            success: true,
            message: "Airtime delivered after timeout",
            transaction: txn,
            providerResponse: statusCheck,
          });
        }
      }

      console.error("[EPINS API ERROR]", error.message);
      txn.status = "failed";
      txn.meta.error = error.message;
      await txn.save();

      if (global.io) {
        global.io.emit("transactionUpdate", {
          type: "airtime",
          status: "failed",
          ref,
          phone,
          amount: numericAmount,
          message: "Airtime purchase failed due to server error",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Airtime purchase failed",
        error: error.message,
      });
    }
  } catch (err) {
    console.error("[EPINS AIRTIME CONTROLLER ERROR]", err.message);
    return res.status(500).json({
      success: false,
      message: "Unexpected error processing airtime purchase",
      error: err.message,
    });
  }
};
