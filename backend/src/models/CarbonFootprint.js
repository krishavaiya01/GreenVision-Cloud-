import mongoose from "mongoose";

const CarbonFootprintSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  month: { type: String, required: true }, // e.g. "2025-09"
  totalEmissions: { type: Number, required: true },
  avgCPUUsage: { type: Number, required: true },
  activeInstances: { type: Number, required: true },
  efficiencyScore: { type: Number, required: true },
  totalCost: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("CarbonFootprint", CarbonFootprintSchema);
