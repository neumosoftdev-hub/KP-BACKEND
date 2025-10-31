import axios from "axios";
import "dotenv/config";

const client = axios.create({
  baseURL: process.env.ASPFIY_BASE_URL || "https://api-v1.aspfiy.com",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.ASPFIY_SECRET_KEY}`,
    Accept: "application/json",
  },
  timeout: 10000,
});

/**
 * Create Reserved Account on Aspfiy
 */
export const createReservedAccount = async (payload) => {
  try {
    const res = await client.post("/reserve-paga/", payload);
    return res.data;
  } catch (err) {
    console.error("Aspfiy API Error:", err.response?.data || err.message);
    throw err;
  }
};
