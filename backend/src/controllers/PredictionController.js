import Prediction from "../models/Prediction.js";
import Joi from "joi";
import mongoose from "mongoose";

// Validation schema for creation/update
const predictionSchema = Joi.object({
  predictedDate: Joi.date().required(),
  predictedConsumption: Joi.number().min(0).required(),
  modelUsed: Joi.string().optional(),
});

// Create
export const createPrediction = async (req, res) => {
  try {
    const { error, value } = predictionSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const prediction = new Prediction({
      ...value,
      user: req.user.id,
    });
    await prediction.save();
    res.status(201).json(prediction);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get all predictions (optionally filter by date/model)
export const getPredictions = async (req, res) => {
  try {
    const query = { user: req.user.id };
    if (req.query.startDate && req.query.endDate) {
      query.predictedDate = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };
    }
    if (req.query.modelUsed) query.modelUsed = req.query.modelUsed;
    const predictions = await Prediction.find(query).sort({ predictedDate: 1 });
    res.json(predictions);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get single prediction
export const getPredictionById = async (req, res) => {
  try {
    const prediction = await Prediction.findOne({ _id: req.params.id, user: req.user.id });
    if (!prediction) return res.status(404).json({ message: "Prediction not found" });
    res.json(prediction);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update prediction
export const updatePrediction = async (req, res) => {
  try {
    const { error, value } = predictionSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const updated = await Prediction.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      value,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Prediction not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Update failed", error: err.message });
  }
};

// Delete prediction
export const deletePrediction = async (req, res) => {
  try {
    const deleted = await Prediction.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!deleted) return res.status(404).json({ message: "Prediction not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Analytics summary: total and average predicted consumption for a date range
export const getPredictionSummary = async (req, res) => {
  try {
    const match = { user: new mongoose.Types.ObjectId(req.user.id) };

    if (req.query.startDate && req.query.endDate) {
      match.predictedDate = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      };
    }

    const agg = await Prediction.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalPredicted: { $sum: "$predictedConsumption" },
          averagePredicted: { $avg: "$predictedConsumption" },
          firstDate: { $min: "$predictedDate" },
          lastDate: { $max: "$predictedDate" },
        },
      },
    ]);

    res.json(agg[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};