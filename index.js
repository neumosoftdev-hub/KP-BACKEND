// index.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cron from "node-cron";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";

import router from "./routes/index.js";
import aspfiyWebhookRoutes from "./routes/aspfiyWebhookRoutes.js";
import Wallet from "./models/Wallet.js";
import airtimeRoutes from "./routes/airtimeRoutes.js";
import dataPlanRoutes from "./routes/dataPlanRoutes.js";
import epinsWebhookRoutes from "./routes/epinsWebhookRoutes.js";
import { syncDataPlans } from "./controllers/dataPlanController.js";
import { syncCablePlans } from "./controllers/cablePlanController.js";
import dataPurchaseRoutes from "./routes/dataPurchaseRoutes.js";
import cableRoutes from "./routes/cableRoutes.js";
import cablePlanRoutes from "./routes/cablePlanRoutes.js";
import CablePlan from "./models/CablePlan.js";
import electricityRoutes from "./routes/electricityRoutes.js";

// 🧩 Load environment variables
dotenv.config();

// 🧠 Express app setup
const app = express();
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || "development";

// 🚀 Create HTTP + WebSocket server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // TODO: change to frontend URL in production
    methods: ["GET", "POST"],
  },
});

// 🧠 Store io globally so controllers can emit events (e.g., after credit/debit)
global.io = io;

// ✅ Listen for new socket connections
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  // 🧠 Join user-specific room
  socket.on("joinUserRoom", async (userId) => {
    try {
      socket.join(userId);
      console.log(`🧩 User joined room: ${userId}`);

      // 🔍 Fetch wallet and send current balance immediately
      const wallet = await Wallet.findOne({ userId });
      if (wallet) {
        io.to(userId).emit("walletUpdate", { balance: wallet.balance });
        console.log(`💰 Sent initial balance to ${userId}: ₦${wallet.balance}`);
      } else {
        console.log(`⚠️ No wallet found for user ${userId}`);
      }
    } catch (err) {
      console.error("❌ Error sending wallet balance:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

// 🧱 Middleware setup
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
if (NODE_ENV === "development") app.use(morgan("dev"));

// 🧩 Connect to MongoDB
connectDB()
  .then(async () => {
    try {
      await Wallet.syncIndexes();
      await CablePlan.syncIndexes();
      console.log("🧩 Wallet & CablePlan indexes synced successfully");
    } catch (err) {
      console.error("⚠️ Index sync failed:", err.message);
    }
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// 🏠 Root route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "KwickPay Backend Running ✅",
    environment: NODE_ENV,
  });
});

// 🧭 API Routes
app.use("/api", router);
app.use("/api/wallet/webhook", aspfiyWebhookRoutes);
app.use("/api/airtime", airtimeRoutes);
app.use("/api/data-plans", dataPlanRoutes);
app.use("/api/webhook", epinsWebhookRoutes);
app.use("/api/data", dataPurchaseRoutes);
app.use("/api/cable", cableRoutes);
app.use("/api/cable-plans", cablePlanRoutes);
app.use("/api/electricity", electricityRoutes);

// 🧯 Handle undefined routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ✅ ------------------ AUTO SYNC CRON JOBS ------------------

// 🕒 1️⃣ Data Plan Sync — every day at 2:00 AM
const CRON_SCHEDULE_DATA = "0 2 * * *";
// const CRON_SCHEDULE_DATA = "* * * * *"; // dev test

cron.schedule(CRON_SCHEDULE_DATA, async () => {
  console.log("🕒 Running automatic DataPlan sync job...");
  console.log("🔑 EPINS Key Loaded:", !!process.env.EPINS_API_KEY);

  try {
    const mockReq = {
      headers: { authorization: `Bearer ${process.env.EPINS_API_KEY}` },
    };
    const mockRes = {
      json: (data) =>
        console.log(
          `✅ DataPlan Sync Successful: ${data.message} (${data.count || 0} plans)`
        ),
      status: (code) => ({
        json: (err) => console.error("❌ DataPlan Sync Failed:", code, err),
      }),
    };

    await syncDataPlans(mockReq, mockRes);
  } catch (err) {
    console.error("❌ DataPlan Sync Error:", err.message);
  }
});

// 🕒 2️⃣ Cable Plan Sync — every day at 3:00 AM
const CRON_SCHEDULE_CABLE = "0 3 * * *";
// const CRON_SCHEDULE_CABLE = "* * * * *"; // dev test

cron.schedule(CRON_SCHEDULE_CABLE, async () => {
  console.log("🕒 Running automatic CablePlan sync job...");
  console.log("🔑 EPINS Key Loaded:", !!process.env.EPINS_API_KEY);

  try {
    const mockReq = {
      headers: { authorization: `Bearer ${process.env.EPINS_API_KEY}` },
    };
    const mockRes = {
      json: (data) =>
        console.log(
          `✅ CablePlan Sync Successful: ${data.message} (${data.count || 0} plans)`
        ),
      status: (code) => ({
        json: (err) => console.error("❌ CablePlan Sync Failed:", code, err),
      }),
    };

    await syncCablePlans(mockReq, mockRes);
  } catch (err) {
    console.error("❌ CablePlan Sync Error:", err.message);
  }
});

// 🚀 Start unified HTTP + WebSocket Server
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT} (${NODE_ENV})`);
});

// 🧯 Global Error Handlers
process.on("unhandledRejection", (err) => {
  console.error("💥 Unhandled Rejection:", err.message);
});

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err.message);
});
