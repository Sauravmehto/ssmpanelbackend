import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    serviceId: {
      type: String,
      required: true,
      trim: true,
    },
    serviceName: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    ratePer1k: {
      type: Number,
      required: true,
      min: 0,
    },
    charge: {
      type: Number,
      required: true,
      min: 0,
    },
    providerOrderId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "cancelled", "partial", "failed"],
      default: "pending",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "refunded"],
      default: "paid",
    },
    failureReason: {
      type: String,
      default: null,
    },
    rawProviderResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const Order = mongoose.model("Order", orderSchema);

export default Order;


