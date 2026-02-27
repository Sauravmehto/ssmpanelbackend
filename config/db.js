import mongoose from "mongoose";
import User from "../models/User.js";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true,
    });

    // Keep DB indexes aligned with current schema and remove stale indexes
    // (e.g. old unique index like phone_1 from previous schema versions).
    await User.syncIndexes();

    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

export default connectDB;


