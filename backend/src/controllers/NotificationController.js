// src/controllers/NotificationController.js
import emailService from '../services/email-service.js';
import aiRecommendationService from '../services/ai-recommendation-service.js';
import User from '../models/User.js';
import CarbonEmissionEvent from '../models/CarbonEmissionEvent.js';
import CloudMetrics from '../models/CloudMetrics.js';

/**
 * Build a compact HTML summary for AI recommendations
 */
function buildRecommendationsHtml({ userName, result }) {
  const items = result.recommendations.slice(0, 10) // limit to 10 for email brevity
    .map((rec, idx) => {
      const savings = rec.potentialSavings ? `$${rec.potentialSavings}` : '-';
      const provider = rec.provider ? ` | Provider: ${String(rec.provider).toUpperCase()}` : '';
      const confidence = rec.confidence ? ` | Confidence: ${rec.confidence}%` : '';
      const priority = rec.priority ? ` | Priority: ${rec.priority}` : '';
      return `<li><strong>${idx + 1}. ${rec.type?.toUpperCase?.() || 'Recommendation'}</strong>: ${rec.description}${provider}${priority}${confidence} | Savings: ${savings}</li>`;
    }).join('');

  const totalSavings = result.recommendations.reduce((s, r) => s + (r.potentialSavings || 0), 0);
  const meta = `Data source: ${result.dataSource || 'mixed'} | Generated at: ${new Date().toLocaleString()}`;

  return `
  <div style="font-family: Arial, sans-serif; line-height:1.5;">
    <h2 style="margin:0 0 8px;">GreenVision Cloud — AI Recommendations</h2>
    <p>Hi ${userName || 'there'}, here is your latest recommendation summary.</p>
    <p><strong>Total recommendations:</strong> ${result.recommendations.length} | <strong>Potential monthly savings:</strong> $${totalSavings.toFixed(2)}</p>
    <ol>${items}</ol>
    <p style="font-size:12px;color:#666;margin-top:16px;">${meta}</p>
  </div>`;
}

export const sendRecommendationsEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    let userEmail = req.user.email;
    let userName = req.user.name || 'GreenVision User';

    // Ensure we have a fresh email from DB if missing in token
    if (!userEmail) {
      const user = await User.findById(userId).select('email name');
      userEmail = user?.email;
      userName = user?.name || userName;
    }

    if (!userEmail) {
      return res.status(400).json({ success: false, message: 'Your account has no email on record.' });
    }

    const result = await aiRecommendationService.generateRecommendations(userId);
    const html = buildRecommendationsHtml({ userName, result });

    await emailService.sendEmail({
      to: userEmail,
      subject: 'Your AI Recommendations Summary — GreenVision Cloud',
      html,
      text: `You have ${result.recommendations.length} recommendations. Potential monthly savings: $${result.recommendations.reduce((s, r) => s + (r.potentialSavings || 0), 0).toFixed(2)}`
    });

    res.json({ success: true, message: 'Email sent', count: result.recommendations.length });
  } catch (err) {
    console.error('sendRecommendationsEmail error:', err);
    res.status(500).json({ success: false, message: 'Failed to send email', error: err.message });
  }
};

export const sendUrgentAlertEmail = async (req, res) => {
  try {
    let userEmail = req.user.email;
    let userName = req.user.name || 'GreenVision User';
    if (!userEmail) {
      const user = await User.findById(req.user.id).select('email name');
      userEmail = user?.email;
      userName = user?.name || userName;
    }
    const { title, message, severity = 'critical', context } = req.body || {};

    if (!userEmail) {
      return res.status(400).json({ success: false, message: 'Your account has no email on record.' });
    }
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'title and message are required' });
    }

    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5;">
        <h2 style="color:#b00020;margin:0 0 8px;">Urgent ${severity.toUpperCase()} Alert</h2>
        <p>Hi ${userName},</p>
        <p><strong>${title}</strong></p>
        <p>${message}</p>
        ${context ? `<pre style="background:#f6f8fa;padding:12px;border-radius:6px;">${JSON.stringify(context, null, 2)}</pre>` : ''}
        <p style="font-size:12px;color:#666;">Sent at ${new Date().toLocaleString()}</p>
      </div>
    `;

    await emailService.sendEmail({
      to: userEmail,
      subject: `Urgent Alert — ${title}`,
      html,
      text: `${title}\n${message}`
    });

    res.json({ success: true, message: 'Urgent alert email sent' });
  } catch (err) {
    console.error('sendUrgentAlertEmail error:', err);
    res.status(500).json({ success: false, message: 'Failed to send urgent email', error: err.message });
  }
};

export default { sendRecommendationsEmail, sendUrgentAlertEmail };

/**
 * Send last-24h Daily Report to the current authenticated user
 * Useful for testing the scheduled daily report (Agenda) via API.
 */
export const sendDailyReportEmail = async (req, res) => {
  try {
    let userEmail = req.user.email;
    let userName = req.user.name || 'GreenVision User';
    const userId = req.user.id;
    if (!userEmail) {
      const user = await User.findById(userId).select('email name');
      userEmail = user?.email;
      userName = user?.name || userName;
    }
    if (!userEmail) return res.status(400).json({ success: false, message: 'Your account has no email on record.' });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const eventsMatch = { windowEnd: { $gte: since }, $or: [{ userId }, { userId: null }] };
    const totalsAgg = await CarbonEmissionEvent.aggregate([
      { $match: eventsMatch },
      { $group: { _id: null, kgCO2: { $sum: '$estimatedCO2Kg' }, cost: { $sum: '$estimatedCost' } } },
      { $project: { _id: 0, kgCO2: { $round: ['$kgCO2', 4] }, cost: { $round: ['$cost', 4] } } }
    ]);
    const totals = totalsAgg[0] || { kgCO2: 0, cost: 0 };

    const byProv = await CarbonEmissionEvent.aggregate([
      { $match: eventsMatch },
      { $group: { _id: '$provider', kgCO2: { $sum: '$estimatedCO2Kg' }, cost: { $sum: '$estimatedCost' } } },
      { $project: { _id: 0, provider: '$_id', kgCO2: { $round: ['$kgCO2', 4] }, cost: { $round: ['$cost', 4] } } },
      { $sort: { kgCO2: -1 } }
    ]);

    const cmAgg = await CloudMetrics.aggregate([
      { $match: { userId, timestamp: { $gte: since } } },
      { $group: { _id: null, avgCPU: { $avg: '$metrics.summary.avgCPU' }, activeInstances: { $avg: '$metrics.totalInstances' } } }
    ]);
    const avgCPU = cmAgg.length ? Number((cmAgg[0].avgCPU || 0).toFixed(2)) : 0;
    const activeInstances = cmAgg.length ? Math.round(cmAgg[0].activeInstances || 0) : 0;

    let recCount = 0; let potentialSavings = 0;
    try {
      const recRes = await aiRecommendationService.generateRecommendations(String(userId));
      recCount = recRes?.recommendations?.length || 0;
      potentialSavings = (recRes?.recommendations || []).reduce((s, r) => s + (r.potentialSavings || 0), 0);
    } catch {}

    const providersHtml = byProv.length
      ? `<table style="width:100%;border-collapse:collapse;margin-top:8px">
          <thead><tr><th align="left">Provider</th><th align="right">CO₂ (kg)</th><th align="right">Cost ($)</th></tr></thead>
          <tbody>
            ${byProv.map(p => `<tr><td>${String(p.provider).toUpperCase()}</td><td align="right">${p.kgCO2}</td><td align="right">${p.cost.toFixed(2)}</td></tr>`).join('')}
          </tbody>
        </table>`
      : '<p style="color:#666">No provider activity in the last 24h.</p>';

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;">
        <h2 style="margin:0 0 8px;">Daily Cloud Report — Last 24h</h2>
        <p>Hi ${userName}, here is your daily summary.</p>
        <ul>
          <li><strong>Emissions:</strong> ${totals.kgCO2} kg CO₂</li>
          <li><strong>Cost:</strong> $${Number(totals.cost || 0).toFixed(2)}</li>
          <li><strong>Avg CPU:</strong> ${avgCPU}%</li>
          <li><strong>Active Instances (avg):</strong> ${activeInstances}</li>
          <li><strong>AI Recommendations:</strong> ${recCount} (potential monthly savings $${potentialSavings.toFixed(2)})</li>
        </ul>
        ${providersHtml}
        <p style="font-size:12px;color:#666;margin-top:12px;">Generated at ${new Date().toLocaleString()}</p>
      </div>`;

    await emailService.sendEmail({
      to: userEmail,
      subject: 'Daily Cloud Report — GreenVision Cloud',
      html,
      text: `24h Emissions: ${totals.kgCO2} kg CO2 | Cost: $${Number(totals.cost||0).toFixed(2)} | Avg CPU: ${avgCPU}% | Active Instances: ${activeInstances} | Recs: ${recCount}`
    });

    res.json({ success: true, message: 'Daily report email sent' });
  } catch (err) {
    console.error('sendDailyReportEmail error:', err);
    res.status(500).json({ success: false, message: 'Failed to send daily report', error: err.message });
  }
};

