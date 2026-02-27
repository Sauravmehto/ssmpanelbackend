import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  let token;

  try {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized, user not found" });
    }

    req.user = { id: user._id.toString(), role: user.role };
    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, token failed" });
  }
};


