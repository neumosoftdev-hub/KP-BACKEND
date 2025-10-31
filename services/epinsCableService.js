// services/epinsCableService.js
import axios from "axios";

// Determine mode and pick keys / base URLs from environment
const MODE = process.env.EPINS_MODE?.toLowerCase() || "live";
const isSandbox = MODE === "sandbox";

const EPINS_BASE_URL = isSandbox
  ? (process.env.EPINS_BASE_URL_SANDBOX || "https://api.epins.com.ng/sandbox")
  : (process.env.EPINS_BASE_URL || "https://api.epins.com.ng/v3/autho");

const EPINS_API_KEY = isSandbox
  ? process.env.EPINS_API_KEY_SANDBOX
  : process.env.EPINS_API_KEY;

const EPINS_TIMEOUT_MS = Number(process.env.EPINS_TIMEOUT_MS) || 15000;

const defaultHeaders = () => ({
  Authorization: `Bearer ${EPINS_API_KEY}`,
  "Content-Type": "application/json",
});

// Basic startup logs so you can confirm environment at boot
console.log("EPINS mode:", MODE);
console.log("EPINS base URL:", EPINS_BASE_URL);
console.log("EPINS API key loaded:", !!EPINS_API_KEY);

// Helper to normalize axios call errors
function formatError(err) {
  if (err?.response?.data) return err.response.data;
  if (err?.message) return { message: err.message };
  return { message: "Unknown error" };
}

const epinsCableService = {
  // Validate smartcard / IUC number
  // Expects payload: { serviceId, billerNumber, vcode }
  async validateSmartcard({ serviceId, billerNumber, vcode }) {
    const url = `${EPINS_BASE_URL.replace(/\/$/, "")}/merchant-verify/`;
    const payload = { serviceId, billerNumber, vcode };

    try {
      console.log("EPINS validate URL:", url);
      console.log("EPINS validate payload:", payload);

      const res = await axios.post(url, payload, {
        headers: defaultHeaders(),
        timeout: EPINS_TIMEOUT_MS,
      });

      // provider response
      const data = res?.data;
      console.log("EPINS validate response:", data);

      // treat codes 119 and 101 as success per docs (119 = validation ok)
      if (data?.code === 119 || data?.code === 101) {
        return { status: "success", code: data.code, data };
      }

      return {
        status: "failed",
        code: data?.code,
        message: data?.description || "Validation failed",
        data,
      };
    } catch (err) {
      const e = formatError(err);
      console.error("EPINS validate error:", e);
      return { status: "failed", message: e, code: err?.response?.data?.code || null };
    }
  },

  // Recharge decoder (purchase)
  // Expects payload: { service, accountno, vcode, amount, ref }
  async recharge({ service, accountno, vcode, amount, ref }) {
    const url = `${EPINS_BASE_URL.replace(/\/$/, "")}/biller/`;
    const payload = { service, accountno, vcode, amount, ref };

    try {
      console.log("EPINS recharge URL:", url);
      // do not log full API key - only indicate presence
      console.log("EPINS recharge payload:", payload);

      const res = await axios.post(url, payload, {
        headers: defaultHeaders(),
        timeout: EPINS_TIMEOUT_MS,
      });

      const data = res?.data;
      console.log("EPINS recharge response:", data);

      if (data?.code === 101) {
        // provider says transaction success
        return { status: "success", code: 101, data };
      }

      // ambiguous or failed codes: return what's provided
      return { status: "failed", code: data?.code || null, message: data?.description || data, data };
    } catch (err) {
      const e = formatError(err);
      console.error("EPINS recharge error:", e);
      return { status: "failed", message: e, code: err?.response?.data?.code || null };
    }
  },

  // Query transaction status using reference
  // POST to .../transaction-status/ (assumed path; adjust if provider uses a different path)
  // Returns provider's response or throws on error
  async checkTransactionStatus(ref) {
    const url = `${EPINS_BASE_URL.replace(/\/$/, "")}/transaction-status/`;
    const payload = { ref };

    try {
      console.log("EPINS status URL:", url);
      console.log("EPINS status payload:", payload);

      const res = await axios.post(url, payload, {
        headers: defaultHeaders(),
        timeout: EPINS_TIMEOUT_MS,
      });

      const data = res?.data;
      console.log("EPINS status response:", data);

      return { status: "success", code: data?.code, data };
    } catch (err) {
      const e = formatError(err);
      console.error("EPINS status error:", e);
      return { status: "failed", message: e, code: err?.response?.data?.code || null };
    }
  },
};

export default epinsCableService;
