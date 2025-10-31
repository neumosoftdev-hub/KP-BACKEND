import axios from "axios";

const EPINS_MODE = process.env.EPINS_MODE?.toLowerCase() || "sandbox";

const EPINS_API_KEY =
  EPINS_MODE === "live"
    ? process.env.EPINS_API_KEY
    : process.env.EPINS_API_KEY_SANDBOX;

const EPINS_BASE_URL =
  EPINS_MODE === "live"
    ? process.env.EPINS_BASE_URL
    : process.env.EPINS_BASE_URL_SANDBOX;

console.log(`[ElectricityService] Mode: ${EPINS_MODE.toUpperCase()} | Base URL: ${EPINS_BASE_URL}`);

/**
 * ✅ Validate Meter Number
 */
export const validateMeter = async ({ serviceId, billerNumber, vcode }) => {
  try {
    const headers = {
      Authorization: `Bearer ${EPINS_API_KEY}`,
      "Content-Type": "application/json",
    };

    const payload = { serviceId, billerNumber, vcode };
    console.log("[ElectricityService] Validating meter:", payload);

    const response = await axios.post(`${EPINS_BASE_URL}/merchant-verify/`, payload, { headers });

    console.log("[ElectricityService] Validation response:", response.data);

    // ✅ EPINS returns code 119 on success
    if (response.data.code === 119) {
      return {
        status: "success",
        data: response.data,
        message: response.data.description || "Meter validation successful",
      };
    }

    return {
      status: "failed",
      data: response.data,
      message: response.data.description || "Meter validation failed",
    };
  } catch (err) {
    console.error("❌ [ElectricityService] Validate Error:", err.response?.data || err.message);
    return {
      status: "failed",
      message: err.response?.data?.message || "Meter validation failed",
      data: err.response?.data || null,
    };
  }
};

/**
 * ⚡ Purchase Electricity Token
 */
export const purchase = async ({ service, accountno, vcode, amount, ref }) => {
  try {
    const headers = {
      Authorization: `Bearer ${EPINS_API_KEY}`,
      "Content-Type": "application/json",
    };

    const payload = { service, accountno, vcode, amount, ref };
    console.log("[ElectricityService] Purchasing electricity:", payload);

    const response = await axios.post(`${EPINS_BASE_URL}/biller/`, payload, { headers });

    console.log("[ElectricityService] Purchase response:", response.data);

    return response.data;
  } catch (err) {
    console.error("❌ [ElectricityService] Purchase Error:", err.response?.data || err.message);
    return {
      status: "failed",
      message: err.response?.data?.message || "Electricity purchase failed",
      data: err.response?.data || null,
    };
  }
};

// ✅ Default export so controller import works
export default {
  validateMeter,
  purchase,
};
