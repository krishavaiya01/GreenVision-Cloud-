import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8 }, // Stronger password
    role: { type: String, enum: ["user", "admin"], default: "user" }, // RBAC
    refreshToken: { type: String }, // Store for refresh token rotation
    preferences: {
      darkMode: { type: Boolean, default: false },
      notifications: { type: Boolean, default: true },
      notificationPrefs: {
        emailEnabled: { type: Boolean, default: true },
        frequency: { type: String, enum: ['instant', 'daily', 'weekly'], default: 'instant' },
        dailyDigestHour: { type: Number, min: 0, max: 23, default: 8 },
        cooldownMinutes: { type: Number, min: 1, max: 1440, default: 60 },
        urgentCpuThreshold: { type: Number, min: 1, max: 100, default: 90 },
        urgentCarbonThreshold: { type: Number, min: 0, default: 0 }, // kg CO2e per hour (0 disables)
      },
      language: { type: String, default: "en" },
    },
  // Deprecated per new design: credentials now managed centrally server-side
  // Keeping placeholders in case of backward compatibility migration
  awsData: { type: Object },
  azureData: { type: Object },
  gcpData: { type: Object },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);