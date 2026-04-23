import mongoose from "mongoose";

const energyDataSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, required: true },
  consumption: { type: Number, required: true, min: 0 }, // enforce >0
  cost: { type: Number, min: 0 },
  source: { type: String, enum: ["manual", "sensor", "imported"], default: "manual" }, // NEW
  tag: { type: String }, // NEW
  co2Emissions: { type: Number, min: 0 }, // NEW
}, { timestamps: true });


export default mongoose.model("EnergyData", energyDataSchema);