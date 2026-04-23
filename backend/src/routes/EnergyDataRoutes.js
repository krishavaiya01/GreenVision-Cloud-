import express from "express";
import {
  createEnergyData,
  getEnergyData,
  getEnergyDataById,
  updateEnergyData,
  deleteEnergyData,
  getEnergySummary,
} from "../controllers/EnergyDataController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect(), createEnergyData);
router.get("/", protect(), getEnergyData);
router.get("/summary", protect(), getEnergySummary);
router.get("/:id", protect(), getEnergyDataById);
router.put("/:id", protect(), updateEnergyData);
router.delete("/:id", protect(), deleteEnergyData);

export default router;