// services/epinsService.js
import axios from "axios";

const EPINS_BASE_URL =
  process.env.EPINS_BASE_URL?.replace(/\/$/, "") ||
  "https://api.epins.com.ng/v3/autho"; // ✅ Correct base URL restored
const EPINS_API_KEY = process.env.EPINS_API_KEY;
const EPINS_TIMEOUT_MS = Number(process.env.EPINS_TIMEOUT_MS) || 20000;

const headers = {
  Authorization: `Bearer ${EPINS_API_KEY}`,
  "Content-Type": "application/json",
};

const epinsService = {
  // 🔹 Get EPINS Wallet Balance
  async getBalance() {
    try {
      const url = `${EPINS_BASE_URL}/account/`;
      const res = await axios.get(url, { headers, timeout: EPINS_TIMEOUT_MS });

      if (res?.data?.code === 101) return res.data;
      throw new Error(res?.data?.description || "Invalid balance response from EPINS");
    } catch (err) {
      console.error("[EPINS BALANCE ERROR]", err.response?.data || err.message);
      throw new Error("Failed to fetch EPINS balance");
    }
  },

  // 🔹 Purchase Airtime
  async purchaseAirtime({ network, phone, amount, ref }) {
    try {
      const url = `${EPINS_BASE_URL}/airtime/`;
      const payload = { network, phone, amount, ref };
      const res = await axios.post(url, payload, { headers, timeout: EPINS_TIMEOUT_MS });

      const data = res?.data;

      if (!data) {
        return {
          code: 999,
          description: "Empty response from EPINS",
          status: "failed",
        };
      }

      // ✅ Success
      if (data.code === 101) {
        return {
          ...data,
          status: "success",
        };
      }

      // ⚠️ Failure with reason
      console.warn("[EPINS WARN]", data);
      return {
        code: data.code || 999,
        description: data.description || "Unknown EPINS failure",
        status: "failed",
      };
    } catch (err) {
      console.error("[EPINS AIRTIME ERROR]", err.response?.data || err.message);
      return {
        code: err.response?.data?.code || 500,
        description:
          err.response?.data?.description ||
          err.message ||
          "Failed to purchase airtime via EPINS",
        status: "failed",
      };
    }
  },

  // 🔹 Check Airtime Transaction Status
  async checkAirtimeStatus(requestId) {
    try {
      const url = `${EPINS_BASE_URL}/airtime/status/${requestId}`;
      const res = await axios.get(url, { headers, timeout: EPINS_TIMEOUT_MS });

      const data = res?.data;

      if (!data) {
        return {
          code: 999,
          description: "Empty response from EPINS status check",
          status: "failed",
        };
      }

      if (data.code === 101 || data.status === "success") {
        return {
          ...data,
          status: "success",
        };
      }

      return {
        code: data.code || 999,
        description: data.description || "Airtime not delivered yet",
        status: "failed",
      };
    } catch (err) {
      console.error("[EPINS STATUS ERROR]", err.response?.data || err.message);
      return {
        code: 500,
        description: err.message || "Failed to check airtime status",
        status: "failed",
      };
    }
  },
};

export default epinsService;
