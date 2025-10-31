import axios from "axios";

const EPINS_BASE_URL = process.env.EPINS_BASE_URL; // e.g. https://api.epins.com.ng/core
const EPINS_API_KEY = process.env.EPINS_API_KEY;   // test key for now

export const buyAirtime = async (network, phone, amount, ref) => {
  try {
    const response = await axios.post(
      `${EPINS_BASE_URL}/airtime/`,
      { network, phone, amount, ref },
      {
        headers: {
          Authorization: `Bearer ${EPINS_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("EPINS Airtime Error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.description || "Airtime purchase failed");
  }
};
