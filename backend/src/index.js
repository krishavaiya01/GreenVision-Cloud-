// backend/src/index.js (Express 5)
import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

// Routes
import authRoutes from "./routes/authRoutes.js";
import EnergyDataRoutes from "./routes/EnergyDataRoutes.js";
import predictionRoutes from "./routes/PredictionRoutes.js";
import cloudMetricRoutes from "./routes/CloudMetricRoutes.js";
import aiRoutes from "./routes/ai.js";
import cloudRoutes from "./routes/cloud.js";
import k8sRoutes from "./routes/k8s.js";
import notificationRoutes from "./routes/notifications.js";
import complianceRoutes from "./routes/compliance.js";


// Services
import { startAwsMetricsScheduler } from "./services/aws-metrics-service.js";
import { startAzureMetricsScheduler } from "./services/azure-metrics-service.js";
import { startGcpMetricsScheduler } from "./services/gcp-metrics-service.js";
import { initAgenda } from "./scheduler/agenda.js";
import { registerAwsLogsJobs } from "./services/aws-logs-service.js";
import { registerAzureLogsJobs } from "./services/azure-logs-service.js";
import { registerGcpLogsJobs, startGcpLogsSubscriber } from "./services/gcp-logs-service.js";
import { initSocket } from "./realtime/socket.js";
import createAuditMiddleware from "./middleware/auditMiddleware.js";

// Optional: server-side axios for external APIs (keep only if used)
import axios from "axios";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL
].filter(Boolean);

// CORS for credentialed requests from Vite/CRA
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || origin.includes('vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Parsers and logs
app.use(cookieParser());
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting on auth
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
});
app.use("/api/auth", limiter);

// Define sensitive routes for audit logging
const sensitiveRoutes = [
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/signup$/,
  /^\/api\/auth\/password$/,
  /^\/api\/cloudmetrics\/(POST|PUT|DELETE)/,
  /^\/api\/ai\/recommendations$/,
  /^\/api\/ai\/rightsizing$/,
  /^\/api\/cloud\/(POST|PUT|DELETE)/,
  /^\/api\/compliance\//,
  /^\/api\/.*\/(update|delete)/i,
  /^\/api\/auth\/admin-data/
];

// Apply audit middleware
app.use(createAuditMiddleware(sensitiveRoutes));

// DB connect
mongoose
  .connect(
    process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/greenvision"
  )
  .then(() => {
    console.log("✅ MongoDB Connected");
    console.log(`📄 Database: ${mongoose.connection.name}`);
    // Start background AWS metrics ingestion
    startAwsMetricsScheduler();
  // Start background Azure metrics ingestion
  startAzureMetricsScheduler();
  // Start background GCP metrics ingestion (counts GCE instances)
  startGcpMetricsScheduler();

    // Init persistent scheduler (Agenda) and register jobs
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/greenvision";
    initAgenda(mongoUri)
      .then(async () => {
        await registerAwsLogsJobs();
        await registerAzureLogsJobs();
        await registerGcpLogsJobs();
        console.log("🗓️ Agenda scheduler initialized; AWS/Azure/GCP logs jobs registered");
      })
      .catch((e) => {
        console.error("Agenda init/register failed:", e.message);
      });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// Health check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "GreenVision Cloud API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/energy-data", EnergyDataRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/cloudmetrics", cloudMetricRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/cloud", cloudRoutes);
app.use("/api/k8s", k8sRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/compliance", complianceRoutes);


// Error handler (keep before 404)
app.use((err, req, res, next) => {
  console.error("🚨 Server Error:", err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error:
      process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  });
});

// 404 handler (must be last)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      "/api/auth",
      "/api/energy-data",
      "/api/predictions",
      "/api/cloudmetrics",
      "/api/ai",
      "/api/cloud",
      "/api/k8s",
      "/api/notifications",
    ],
  });
});

// Init WebSocket server
initSocket(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || origin.includes('vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Start server
const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`🚀 GreenVision Cloud Server running on port ${PORT}`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}/api/`);
  // Start GCP Pub/Sub logs subscriber if configured
  startGcpLogsSubscriber().catch((e) => console.warn('gcp-logs:subscriber init failed', e.message));
});

// Optional: external AWS API client (server-side usage only)
export const externalAwsApi = axios.create({
  baseURL: process.env.AWS_API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.AWS_API_TOKEN}`,
  },
});
