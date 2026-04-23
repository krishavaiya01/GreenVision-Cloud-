// src/controllers/NotificationPrefsController.js
import User from '../models/User.js';

export const getNotificationPrefs = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('preferences.notificationPrefs');
    const prefs = user?.preferences?.notificationPrefs || null;
    res.json({ success: true, data: prefs });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load notification preferences', error: e.message });
  }
};

export const updateNotificationPrefs = async (req, res) => {
  try {
    const patch = req.body || {};
    const validKeys = ['emailEnabled', 'frequency', 'dailyDigestHour', 'cooldownMinutes', 'urgentCpuThreshold', 'urgentCarbonThreshold'];
    const setObj = {};
    for (const k of validKeys) {
      if (patch[k] !== undefined) setObj[`preferences.notificationPrefs.${k}`] = patch[k];
    }
    // sanitize frequency and hour if provided
    if (patch.frequency && !['daily','weekly','off'].includes(patch.frequency)) {
      return res.status(400).json({ success: false, message: 'frequency must be one of daily|weekly|off' });
    }
    if (patch.dailyDigestHour !== undefined) {
      const h = Number(patch.dailyDigestHour);
      if (Number.isNaN(h) || h < 0 || h > 23) return res.status(400).json({ success: false, message: 'dailyDigestHour must be 0-23' });
    }
    if (Object.keys(setObj).length === 0) return res.status(400).json({ success: false, message: 'No valid preference fields provided' });
    const updated = await User.findByIdAndUpdate(req.user.id, { $set: setObj }, { new: true }).select('preferences.notificationPrefs');
    res.json({ success: true, data: updated?.preferences?.notificationPrefs || null });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to update notification preferences', error: e.message });
  }
};

export default { getNotificationPrefs, updateNotificationPrefs };
