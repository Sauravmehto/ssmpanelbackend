import mongoose from "mongoose";
import Order from "../models/Order.js";
import User from "../models/User.js";

const SERVICES = [
  {
    id: "1",
    category: "instagram",
    name: "Instagram Followers [HQ] - 1K/day",
    ratePer1k: 0.5,
    min: 100,
    max: 50000,
    providerServiceId: "1",
  },
  {
    id: "2",
    category: "instagram",
    name: "Instagram Likes [Real] - Instant",
    ratePer1k: 0.3,
    min: 50,
    max: 100000,
    providerServiceId: "2",
  },
  {
    id: "3",
    category: "instagram",
    name: "Instagram Views [Fast]",
    ratePer1k: 0.1,
    min: 100,
    max: 1000000,
    providerServiceId: "3",
  },
];

const VALID_URL = /^https?:\/\/.+/i;

const round2 = (n) => Math.round(n * 100) / 100;

async function placeProviderOrder(order, providerServiceId) {
  const useRealProvider = process.env.USE_REAL_SMM_PROVIDER === "true";
  if (!useRealProvider) {
    return {
      success: true,
      providerOrderId: `demo_${Date.now()}`,
      raw: { mode: "mock", message: "Provider call mocked" },
    };
  }

  const providerUrl = process.env.SMM_API_URL || "https://cheapestsmmpanels.com/api/v2";
  const body = new URLSearchParams({
    key: process.env.SMM_API_KEY || "",
    action: "add",
    service: providerServiceId,
    link: order.link,
    quantity: String(order.quantity),
  });

  const response = await fetch(providerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    return { success: false, message: "Invalid provider response", raw: null };
  }

  if (!response.ok || !data || !data.order) {
    return {
      success: false,
      message: data?.error || "Provider rejected order",
      raw: data,
    };
  }

  return {
    success: true,
    providerOrderId: String(data.order),
    raw: data,
  };
}

// @desc    Create order
// @route   POST /api/orders
// @access  Private
export const createOrder = async (req, res, next) => {
  try {
    const { category, serviceId, link, quantity } = req.body;
    const parsedQuantity = Number(quantity);

    if (!category || !serviceId || !link || !parsedQuantity) {
      return res.status(400).json({
        success: false,
        message: "Category, service, link and quantity are required",
      });
    }

    if (!VALID_URL.test(link)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid URL (http/https)",
      });
    }

    const service = SERVICES.find(
      (s) => s.id === String(serviceId) && s.category === String(category).toLowerCase(),
    );
    if (!service) {
      return res.status(400).json({ success: false, message: "Invalid service selected" });
    }

    if (parsedQuantity < service.min || parsedQuantity > service.max) {
      return res.status(400).json({
        success: false,
        message: `Quantity must be between ${service.min} and ${service.max}`,
      });
    }

    const charge = round2((parsedQuantity * service.ratePer1k) / 1000);

    const session = await mongoose.startSession();
    let createdOrder = null;
    let userAfterDeduction = null;

    try {
      await session.withTransaction(async () => {
        const user = await User.findById(req.user.id).session(session);
        if (!user) {
          const err = new Error("User not found");
          err.statusCode = 404;
          throw err;
        }

        if (user.walletBalance < charge) {
          const err = new Error("Insufficient balance. Please add funds.");
          err.statusCode = 400;
          throw err;
        }

        user.walletBalance = round2(user.walletBalance - charge);
        await user.save({ session });

        const orders = await Order.create(
          [
            {
              user: user._id,
              category: service.category,
              serviceId: service.id,
              serviceName: service.name,
              link,
              quantity: parsedQuantity,
              ratePer1k: service.ratePer1k,
              charge,
              status: "pending",
              paymentStatus: "paid",
            },
          ],
          { session },
        );
        createdOrder = orders[0];
        userAfterDeduction = user.walletBalance;
      });
    } finally {
      await session.endSession();
    }

    const providerResult = await placeProviderOrder(createdOrder, service.providerServiceId);
    if (!providerResult.success) {
      const rollbackSession = await mongoose.startSession();
      try {
        await rollbackSession.withTransaction(async () => {
          await User.findByIdAndUpdate(
            req.user.id,
            { $inc: { walletBalance: charge } },
            { new: true, session: rollbackSession },
          );

          await Order.findByIdAndUpdate(
            createdOrder._id,
            {
              status: "failed",
              paymentStatus: "refunded",
              failureReason: providerResult.message || "Provider order failed",
              rawProviderResponse: providerResult.raw || null,
            },
            { session: rollbackSession },
          );
        });
      } finally {
        await rollbackSession.endSession();
      }

      return res.status(502).json({
        success: false,
        message: "Provider failed to place order. Amount refunded to wallet.",
      });
    }

    const finalOrder = await Order.findByIdAndUpdate(
      createdOrder._id,
      {
        status: "processing",
        providerOrderId: providerResult.providerOrderId,
        rawProviderResponse: providerResult.raw || null,
      },
      { new: true },
    );

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: finalOrder,
      walletBalance: userAfterDeduction,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List current user orders
// @route   GET /api/orders/my
// @access  Private
export const getMyOrders = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const query = { user: req.user.id };

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { serviceName: { $regex: search, $options: "i" } },
        { link: { $regex: search, $options: "i" } },
        { providerOrderId: { $regex: search, $options: "i" } },
      ];
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });

    return res.json({ success: true, orders });
  } catch (error) {
    next(error);
  }
};


