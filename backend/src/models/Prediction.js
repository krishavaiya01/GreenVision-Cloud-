import mongoose from "mongoose";

const predictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    predictedDate: { type: Date, required: true },
    predictedConsumption: { type: Number, required: true }, // kWh
    modelUsed: { type: String, default: "LSTM" }, // AI model type
  },
  { timestamps: true }
);

export default mongoose.model("Prediction", predictionSchema);