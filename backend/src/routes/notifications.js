// src/routes/notifications.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { sendRecommendationsEmail, sendUrgentAlertEmail, sendDailyReportEmail } from '../controllers/NotificationController.js';
import { getNotificationPrefs, updateNotificationPrefs } from '../controllers/NotificationPrefsController.js';

const router = express.Router();

// All notification routes require auth
router.use(protect());

// POST /api/notifications/ai-recommendations
router.post('/ai-recommendations', sendRecommendationsEmail);

// POST /api/notifications/urgent
router.post('/urgent', sendUrgentAlertEmail);

// POST /api/notifications/daily-report (test trigger for current user)
router.post('/daily-report', sendDailyReportEmail);

// GET/PUT /api/notifications/prefs
router.get('/prefs', getNotificationPrefs);
router.put('/prefs', updateNotificationPrefs);

export default router;
