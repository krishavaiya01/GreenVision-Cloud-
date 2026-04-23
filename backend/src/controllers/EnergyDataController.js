import EnergyData from "../models/EnergyData.js";
import Joi from "joi";

// Validation schema for creation/update
const energySchema = Joi.object({
  date: Joi.date().required(),
  consumption: Joi.number().min(0).required(),
  cost: Joi.number().min(0).optional(),
  source: Joi.string().valid("manual","sensor","imported").optional(),
  tag: Joi.string().optional(),
});

// Carbon emission factor, e.g. kg CO2/kWh (customize per region/provider)
const EMISSION_FACTOR = 0.45;

// Create
export const createEnergyData = async (req, res) => {
  try {
    const { error, value } = energySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const co2Emissions = value.consumption * EMISSION_FACTOR;
    const newData = new EnergyData({
      ...value,
      user: req.user.id,
      co2Emissions,
    });
    await newData.save();
    res.status(201).json(newData);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get all (filterable)
export const getEnergyData = async (req, res) => {
  try {
    const query = { user: req.user.id };
    if (req.query.startDate && req.query.endDate) {
      query.date = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };
    }
    if (req.query.tag) query.tag = req.query.tag;
    if (req.query.source) query.source = req.query.source;
    const entries = await EnergyData.find(query).sort({ date: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get single
export const getEnergyDataById = async (req, res) => {
  try {
    const entry = await EnergyData.findOne({ _id: req.params.id, user: req.user.id });
    if (!entry) return res.status(404).json({ message: "Data not found" });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update
export const updateEnergyData = async (req, res) => {
  try {
    const { error, value } = energySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    if (value.consumption) value.co2Emissions = value.consumption * EMISSION_FACTOR;
    const updated = await EnergyData.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      value,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Data not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Update failed", error: err.message });
  }
};

// Delete
export const deleteEnergyData = async (req, res) => {
  try {
    const deleted = await EnergyData.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!deleted) return res.status(404).json({ message: "Data not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Summary analytics
export const getEnergySummary = async (req, res) => {
  try {
    const summary = await EnergyData.aggregate([
      {
        $group: {
          _id: "$user",
          totalConsumption: { $sum: "$consumption" },
          totalCost: { $sum: "$cost" },
          avgConsumption: { $avg: "$consumption" }
        }
      }
    ]);

    if (summary.length === 0) {
      return res.status(200).json({
        totalConsumption: 0,
        totalCost: 0,
        avgConsumption: 0
      });
    }

    // Return the first object because $group returns an array
    res.status(200).json(summary[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
