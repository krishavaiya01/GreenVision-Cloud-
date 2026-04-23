import express from "express";
import {
  createPrediction,
  getPredictions,
  getPredictionById,
  updatePrediction,
  deletePrediction,
  getPredictionSummary
} from "../controllers/PredictionController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect(), createPrediction); // Add prediction
router.get("/", protect(), getPredictions); // List predictions (filterable)
router.get("/summary", protect(), getPredictionSummary); // Analytics endpoint
router.get("/:id", protect(), getPredictionById); // Single prediction
router.put("/:id", protect(), updatePrediction); // Update
router.delete("/:id", protect(), deletePrediction); // Delete

export default router;