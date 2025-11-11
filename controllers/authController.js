// controllers/authController.js
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import PendingUser from "../models/PendingUser.js";
import User from "../models/User.js";
import { sendOTPEmail } from "../utils/sendEmail.js";
import { createReservedAccount } from "../utils/aspfiy.js";
import Wallet from "../models/Wallet.js"; // ✅ Make sure this import exists

const OTP_EXP_MIN = Number(process.env.OTP_EXPIRY_MINUTES || 10);

/* Helpers */
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const generateMerchantReference = () =>
  `KWK-${crypto.randomBytes(8).toString("hex")}`;

/* === Register === */
export const register = async (req, res) => {
  try {
    console.log("🟡 Register route hit");
    const {
      firstName,
      lastName,
      email,
      phone,
      state,
      password,
      confirmPassword,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !state ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({
        message:
          "An account already exists with that email or phone. Please login.",
      });
    }

    await PendingUser.deleteMany({ $or: [{ email }, { phone }] });

    const hashed = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + OTP_EXP_MIN * 60 * 1000);

    await PendingUser.create({
      firstName,
      lastName,
      email,
      phone,
      state,
      password: hashed,
      otp,
      otpExpires,
    });

    console.log(`OTP for ${email}: ${otp}`);
    await sendOTPEmail(email, otp, { expiresInMinutes: OTP_EXP_MIN });
    console.log("✅ OTP email sent");

    return res
      .status(200)
      .json({ message: "OTP sent to email for verification." });
  } catch (err) {
    console.error("❌ Register error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

/* === Verify OTP & Reserve Aspfiy Account (create or replace user) === */
export const verifyOtp = async (req, res) => {
  try {
    console.log("🟡 Verify OTP route hit");
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ message: "Missing email or OTP" });

    const pending = await PendingUser.findOne({ email });
    if (!pending)
      return res.status(400).json({ message: "No pending registration found" });

    if (pending.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    if (pending.otpExpires < new Date()) {
      await PendingUser.deleteOne({ _id: pending._id });
      return res
        .status(400)
        .json({ message: "OTP expired. Please register again." });
    }

    const existingUser = await User.findOne({
      $or: [{ email: pending.email }, { phone: pending.phone }],
    });

    let user;
    if (existingUser) {
      existingUser.firstName = pending.firstName;
      existingUser.lastName = pending.lastName;
      existingUser.state = pending.state;
      existingUser.password = pending.password;
      existingUser.pendingOnboarding = true;
      user = await existingUser.save();
    } else {
      user = await User.create({
        firstName: pending.firstName,
        lastName: pending.lastName,
        email: pending.email,
        phone: pending.phone,
        state: pending.state,
        password: pending.password,
        pendingOnboarding: true,
      });
    }

    await PendingUser.deleteOne({ _id: pending._id });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || "7d" }
    );

    return res.status(200).json({
      message:
        "OTP verified successfully. Please set your transaction PIN next.",
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        pendingOnboarding: true,
      },
    });
  } catch (err) {
    console.error("❌ Verify OTP Error:", err);
    return res
      .status(500)
      .json({ message: "Server error during OTP verification" });
  }
};

/* === Login === */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Missing email or password" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || "7d" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        aspfiyAccount: user.aspfiyAccount || null,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    return res.status(500).json({ message: "Server error during login" });
  }
};

/* === Forgot Password === */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ message: "No account found with this email" });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    user.resetOtp = otp;
    user.resetOtpExpires = otpExpires;
    await user.save();

    await sendOTPEmail(email, otp);
    console.log(`🔵 Reset OTP sent to ${email}: ${otp}`);

    return res
      .status(200)
      .json({ message: "Password reset OTP sent to your email." });
  } catch (err) {
    console.error("❌ Forgot password error:", err);
    return res
      .status(500)
      .json({ message: "Server error during password reset request" });
  }
};

export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ message: "Email and OTP are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.resetOtp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    if (user.resetOtpExpires < new Date())
      return res
        .status(400)
        .json({ message: "OTP expired. Please request again." });

    user.resetVerified = true;
    await user.save();

    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (err) {
    console.error("❌ Verify reset OTP error:", err);
    return res.status(500).json({ message: "Server error verifying OTP" });
  }
};

/* === Reset Password === */
export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword)
      return res.status(400).json({ message: "Missing required fields" });

    if (newPassword !== confirmPassword)
      return res.status(400).json({ message: "Passwords do not match" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.resetVerified)
      return res
        .status(400)
        .json({ message: "OTP not verified. Please verify first." });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    user.resetVerified = undefined;
    await user.save();

    return res
      .status(200)
      .json({ message: "Password reset successful. You can now login." });
  } catch (err) {
    console.error("❌ Reset password error:", err);
    return res
      .status(500)
      .json({ message: "Server error during password reset" });
  }
};



/* === Set Transaction PIN === */
export const setTransactionPin = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { pin } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!/^\d{4}$/.test(pin))
      return res
        .status(400)
        .json({ message: "Transaction PIN must be exactly 4 digits" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const hashedPin = await bcrypt.hash(pin, 10);
    user.transactionPin = hashedPin;

    let accountCreated = false;
    if (!user.aspfiyAccount || !user.aspfiyAccount.accountNumber) {
      console.log("🟡 No Aspfiy account found — creating reserved account...");

      const merchantReference = generateMerchantReference();
      const aspfiyPayload = {
        reference: merchantReference,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        webhookUrl: process.env.ASPFIY_WEBHOOK_URL,
      };

      try {
        const aspfiyResponse = await createReservedAccount(aspfiyPayload);
        const data = aspfiyResponse?.data || aspfiyResponse || {};
        const accountInfo = data?.account || data;

        if (accountInfo?.account_number || data?.account_number) {
          user.aspfiyAccount = {
            accountNumber: accountInfo.account_number || data.account_number,
            accountName: accountInfo.account_name || data.account_name,
            bankName: accountInfo.bank_name || data.bank_name,
            merchantReference,
            aspfiyRef: data.reference || data.aspfiy_ref || null,
            createdAt: new Date(),
          };
          accountCreated = true;
          console.log("✅ Aspfiy account reserved successfully");
        } else {
          console.error("❌ Aspfiy account creation failed:", data);
          return res.status(502).json({
            success: false,
            message:
              "Failed to reserve Aspfiy account. Please try again later.",
          });
        }
      } catch (aspErr) {
        console.error("❌ Error during Aspfiy reservation:", aspErr);
        return res.status(502).json({
          success: false,
          message: "Failed to connect to Aspfiy service.",
        });
      }
    }

    user.status = "active";
    user.pendingOnboarding = false;
    await user.save();

    console.log("✅ Transaction PIN set and user activated");

    return res.status(200).json({
      success: true,
      message: accountCreated
        ? "Transaction PIN set successfully and account reserved."
        : "Transaction PIN set successfully.",
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        status: user.status,
        pendingOnboarding: false,
        aspfiyAccount: user.aspfiyAccount || null,
      },
    });
  } catch (err) {
    console.error("❌ Set Transaction PIN error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while setting transaction PIN",
    });
  }
};

export const sendPinResetOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.pinOtp = otp;
    user.pinOtpExpires = otpExpires;
    await user.save();

    await sendOTPEmail(user.email, otp, { expiresInMinutes: 10 });
    console.log(`🔵 PIN reset OTP sent to ${user.email}: ${otp}`);

    return res.status(200).json({ message: "OTP sent to email for PIN reset" });
  } catch (err) {
    console.error("❌ Send PIN Reset OTP error:", err);
    return res
      .status(500)
      .json({ message: "Server error sending PIN reset OTP" });
  }
};

export const verifyPinResetOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otp } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.pinOtp)
      return res.status(400).json({ message: "No OTP pending" });

    if (user.pinOtp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });
    if (user.pinOtpExpires < new Date())
      return res.status(400).json({ message: "OTP expired" });

    user.pinOtp = null;
    user.pinOtpExpires = null;
    await user.save();

    return res.status(200).json({
      message: "OTP verified. You may now reset your transaction PIN.",
    });
  } catch (err) {
    console.error("❌ Verify PIN OTP error:", err);
    return res.status(500).json({ message: "Server error verifying PIN OTP" });
  }
};

export const resetTransactionPin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { newPin, confirmPin } = req.body;

    if (!newPin || !confirmPin)
      return res.status(400).json({ message: "Both fields are required" });
    if (newPin !== confirmPin)
      return res.status(400).json({ message: "PINs do not match" });
    if (newPin.length < 4 || newPin.length > 6)
      return res.status(400).json({ message: "PIN must be 4–6 digits" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const hashedPin = await bcrypt.hash(newPin, 10);
    user.transactionPin = hashedPin;
    await user.save();

    return res
      .status(200)
      .json({ message: "Transaction PIN reset successfully" });
  } catch (err) {
    console.error("❌ Reset Transaction PIN error:", err);
    return res.status(500).json({ message: "Server error resetting PIN" });
  }
};

/* === Verify Transaction PIN (for purchases, transfers, etc.) === */
export const verifyTransactionPin = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { pin } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!pin) return res.status(400).json({ message: "PIN is required" });

    const user = await User.findById(userId);
    if (!user || !user.transactionPin)
      return res.status(400).json({ message: "Transaction PIN not set" });

    const isMatch = await bcrypt.compare(pin, user.transactionPin);
    if (!isMatch)
      return res.status(400).json({ success: false, message: "Invalid PIN" });

    return res.status(200).json({ success: true, message: "PIN verified" });
  } catch (err) {
    console.error("❌ Verify Transaction PIN error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error verifying transaction PIN",
    });
  }
};


/* === Get Profile === */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(userId).select(
      "-password -transactionPin"
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // ✅ Get wallet balance for this user
    const wallet = await Wallet.findOne({ userId: user._id });
    const balance = wallet?.balance || 0;

    return res.status(200).json({
      success: true,
      user: {
        ...user.toObject(),
        balance, // ✅ Add balance field here
      },
    });
  } catch (err) {
    console.error("❌ Get Profile error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error fetching profile" });
  }
};
