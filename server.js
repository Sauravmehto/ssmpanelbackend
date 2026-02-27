import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middlewares
app.use(helmet());

const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: corsOrigin === "*" ? true : corsOrigin,
    credentials: corsOrigin !== "*",
  }),
);
app.use(morgan("dev"));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ status: "OK", message: "SMM Panel Auth API running" });
});
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  if (err && err.code === 11000) {
    const duplicateField = Object.keys(err.keyPattern || {})[0] || "field";
    return res.status(400).json({
      success: false,
      message: `${duplicateField} already registered`,
    });
  }

  const statusCode = err.statusCode || 500;
  const message =
    statusCode === 500 ? "Internal server error" : err.message || "Error";

  res.status(statusCode).json({
    success: false,
    message,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


