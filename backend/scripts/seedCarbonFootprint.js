// src/controllers/CarbonFootprintController.js
import mongoose from "mongoose";
import CarbonFootprint from "../src/models/CarbonFootprint.js";

// Get per-user carbon footprint data (latest month)
export const getUserCarbonFootprint = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id); // ✅ convert to ObjectId

    console.log("📥 Fetching CarbonFootprint for user:", userId);

    const latest = await CarbonFootprint.findOne({ userId }).sort({ createdAt: -1 });

    if (!latest) {
      console.log("⚠️ No carbon footprint found for user:", userId);
      return res.status(404).json({ success: false, message: "No carbon footprint data found for user." });
    }

    res.json({ success: true, data: latest });
  } catch (error) {
    console.error("❌ CarbonFootprint API Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch carbon footprint data",
      error: error.message
    });
  }
};

// Get carbon footprint trends for user (last N months)
export const getUserCarbonTrends = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id); // ✅ convert to ObjectId
    const months = parseInt(req.query.months, 10) || 6;

    const trends = await CarbonFootprint.find({ userId })
      .sort({ month: -1 })
      .limit(months);

    res.json({ success: true, data: trends });
  } catch (error) {
    console.error("❌ CarbonFootprint Trends API Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch carbon footprint trends",
      error: error.message
    });
  }
}

// Example data for user 68b1b50e15784025f9c8e9d7
const userId = "68cc1a3ec178de3b191bf1d9";
const seedData = [
  {
    userId,
    month: "2025-09",
    totalEmissions: 120.5,
    avgCPUUsage: 65,
    activeInstances: 3,
    efficiencyScore: 78,
    totalCost: 250,
    createdAt: new Date("2025-09-24T10:00:00Z")
  },
  {
    userId,
    month: "2025-08",
    totalEmissions: 95.2,
    avgCPUUsage: 52,
    activeInstances: 2,
    efficiencyScore: 84,
    totalCost: 180,
    createdAt: new Date("2025-08-24T10:00:00Z")
  }
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/greenvision', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  await CarbonFootprint.deleteMany({ userId });
  await CarbonFootprint.insertMany(seedData);
  console.log('Seeded carbon footprint data for user:', userId);
  await mongoose.disconnect();
}

seed();
