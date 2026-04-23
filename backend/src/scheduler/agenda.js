import Agenda from 'agenda';
import User from '../models/User.js';
import aiRecommendationService from '../services/ai-recommendation-service.js';
import emailService from '../services/email-service.js';
import EmailDeliveryLog from '../models/EmailDeliveryLog.js';
import CarbonEmissionEvent from '../models/CarbonEmissionEvent.js';
import CloudMetrics from '../models/CloudMetrics.js';

let agendaInstance = null;

export async function initAgenda(mongoConnectionString) {
  if (agendaInstance) return agendaInstance;
  agendaInstance = new Agenda({
    db: { address: mongoConnectionString, collection: process.env.AGENDA_COLLECTION || 'agendaJobs' },
    processEvery: process.env.AGENDA_PROCESS_EVERY || '5 seconds',
    defaultConcurrency: parseInt(process.env.AGENDA_DEFAULT_CONCURRENCY || '5', 10),
    maxConcurrency: parseInt(process.env.AGENDA_MAX_CONCURRENCY || '20', 10),
    lockLimit: parseInt(process.env.AGENDA_LOCK_LIMIT || '50', 10),
  });
  await agendaInstance.start();

  // Define a daily digest runner that executes hourly and fans out to users whose preferred hour matches current hour
  agendaInstance.define('notifications:daily-digest', async () => {
    try {
      const now = new Date();
      const hour = now.getHours();
      const users = await User.find({ 'preferences.notificationPrefs.emailEnabled': true, 'preferences.notificationPrefs.frequency': 'daily' }, '_id email name preferences');
      for (const u of users) {
        const prefHour = u.preferences?.notificationPrefs?.dailyDigestHour ?? 8;
        if (prefHour !== hour) continue;
        try {
          const result = await aiRecommendationService.generateRecommendations(u._id.toString());
          const count = result.recommendations?.length || 0;
          const totalSavings = result.recommendations?.reduce((s, r) => s + (r.potentialSavings || 0), 0) || 0;
          const items = (result.recommendations || []).slice(0, 10).map((r, i) => `<li><strong>${r.type?.toUpperCase?.() || 'Rec'}</strong>: ${r.description} | $${r.potentialSavings || 0}</li>`).join('');
          const html = `<div style="font-family:Arial,sans-serif"><h3>Daily AI Recommendations Summary</h3><p>Total: ${count} | Potential Monthly Savings: $${totalSavings.toFixed(2)}</p><ol>${items}</ol><p>Sent at ${now.toLocaleString()}</p></div>`;
          await emailService.sendEmail({ to: u.email, subject: 'Daily AI Recommendations Summary', html, text: `Total ${count}, Savings $${totalSavings.toFixed(2)}` });
        } catch (perUserErr) {
          console.warn('daily-digest per-user failed', u._id.toString(), perUserErr.message);
        }
      }
    } catch (err) {
      console.warn('daily-digest job failed', err.message);
    }
  });

  // Schedule the digest runner to run every hour (top of hour)
  const every = process.env.DAILY_DIGEST_CRON || '0 * * * *';
  await agendaInstance.every(every, 'notifications:daily-digest');

  // Define a daily cloud report that compiles last-24h metrics and emails all users
  agendaInstance.define('notifications:daily-report', async () => {
    const enabled = String(process.env.DAILY_REPORT_ENABLED || 'true').toLowerCase() === 'true';
    if (!enabled) return;
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const users = await User.find({ email: { $exists: true, $ne: null } }, '_id email name preferences').lean();
      for (const u of users) {
        try {
          // Respect per-user opt-out and preferred hour
          const emailEnabled = u.preferences?.notificationPrefs?.emailEnabled !== false;
          const frequency = u.preferences?.notificationPrefs?.frequency || 'daily';
          const prefHour = u.preferences?.notificationPrefs?.dailyDigestHour ?? 7;
          const now = new Date();
          if (!emailEnabled || frequency === 'off' || now.getHours() !== prefHour) continue;

          // Aggregate last 24h emissions and cost (include shared/null events as in controllers)
          const eventsMatch = { windowEnd: { $gte: since }, $or: [{ userId: u._id }, { userId: null }] };
          const totalsAgg = await CarbonEmissionEvent.aggregate([
            { $match: eventsMatch },
            { $group: { _id: null, kgCO2: { $sum: '$estimatedCO2Kg' }, cost: { $sum: '$estimatedCost' } } },
            { $project: { _id: 0, kgCO2: { $round: ['$kgCO2', 4] }, cost: { $round: ['$cost', 4] } } }
          ]);
          const totals = totalsAgg[0] || { kgCO2: 0, cost: 0 };

          // Per-provider breakdown (last 24h)
          const byProv = await CarbonEmissionEvent.aggregate([
            { $match: eventsMatch },
            { $group: { _id: '$provider', kgCO2: { $sum: '$estimatedCO2Kg' }, cost: { $sum: '$estimatedCost' } } },
            { $project: { _id: 0, provider: '$_id', kgCO2: { $round: ['$kgCO2', 4] }, cost: { $round: ['$cost', 4] } } },
            { $sort: { kgCO2: -1 } }
          ]);

          // Avg CPU and active instances from CloudMetrics (last 24h)
          const cmAgg = await CloudMetrics.aggregate([
            { $match: { userId: u._id, timestamp: { $gte: since } } },
            { $group: { _id: null, avgCPU: { $avg: '$metrics.summary.avgCPU' }, activeInstances: { $avg: '$metrics.totalInstances' } } }
          ]);
          const avgCPU = cmAgg.length ? Number((cmAgg[0].avgCPU || 0).toFixed(2)) : 0;
          const activeInstances = cmAgg.length ? Math.round(cmAgg[0].activeInstances || 0) : 0;

          // Optional: include recommendations count for context
          let recCount = 0; let potentialSavings = 0;
          try {
            const recRes = await aiRecommendationService.generateRecommendations(String(u._id));
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
              <p>Hi ${u.name || 'there'}, here is your daily summary.</p>
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

          // Build CSV attachment from byProv + totals
          const header = ['provider','kgCO2','costUSD'];
          const rows = [header.join(',')];
          for (const p of byProv) rows.push([p.provider, p.kgCO2, Number(p.cost||0).toFixed(4)].join(','));
          rows.push(['TOTAL', totals.kgCO2, Number(totals.cost||0).toFixed(4)].join(','));
          const csvContent = rows.join('\n');

          const sendInfo = await emailService.sendEmail({
            to: u.email,
            subject: 'Daily Cloud Report — GreenVision Cloud',
            html,
            text: `24h Emissions: ${totals.kgCO2} kg CO2 | Cost: $${Number(totals.cost||0).toFixed(2)} | Avg CPU: ${avgCPU}% | Active Instances: ${activeInstances} | Recs: ${recCount}`,
            attachments: [
              { filename: `daily_report_${now.toISOString().slice(0,10)}.csv`, content: csvContent, contentType: 'text/csv' }
            ]
          });
          await EmailDeliveryLog.create({ userId: u._id, email: u.email, type: 'daily', status: 'sent', attempts: 1, meta: { totals, avgCPU, activeInstances, recCount }, sentAt: new Date() });
        } catch (perUserErr) {
          console.warn('daily-report per-user failed', u._id?.toString?.() || 'unknown', perUserErr.message);
          try { await EmailDeliveryLog.create({ userId: u._id, email: u.email, type: 'daily', status: 'failed', attempts: 1, error: perUserErr.message, sentAt: new Date() }); } catch {}
        }
      }
    } catch (err) {
      console.warn('daily-report job failed', err.message);
    }
  });

  // Schedule the daily report at a configured cron (default 07:00 daily)
  const reportCron = process.env.DAILY_REPORT_CRON || '0 7 * * *';
  await agendaInstance.every(reportCron, 'notifications:daily-report');

  // Weekly summary with trends
  agendaInstance.define('notifications:weekly-summary', async () => {
    const enabled = String(process.env.WEEKLY_SUMMARY_ENABLED || 'true').toLowerCase() === 'true';
    if (!enabled) return;
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s=>s.trim()).filter(Boolean);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
  const users = await User.find({ email: { $exists: true, $ne: null, }, 'preferences.notificationPrefs.emailEnabled': { $ne: false }, 'preferences.notificationPrefs.frequency': 'weekly' }, '_id email name preferences').lean();
      for (const u of users) {
        // retry/backoff per user up to 3 attempts
        let attempt = 0; let sent = false; let lastErr = null;
        while (attempt < 3 && !sent) {
          try {
            attempt++;
            // 7-day totals by day
            const match = { windowEnd: { $gte: since }, $or: [{ userId: u._id }, { userId: null }] };
            const byDay = await CarbonEmissionEvent.aggregate([
              { $match: match },
              { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$windowEnd' } }, kgCO2: { $sum: '$estimatedCO2Kg' }, cost: { $sum: '$estimatedCost' } } },
              { $project: { _id: 0, day: '$_id', kgCO2: { $round: ['$kgCO2', 4] }, cost: { $round: ['$cost', 4] } } },
              { $sort: { day: 1 } }
            ]);
            const totalKg = byDay.reduce((s, d) => s + (d.kgCO2 || 0), 0);
            const totalCost = byDay.reduce((s, d) => s + (d.cost || 0), 0);
            const trendCsv = ['day,kgCO2,costUSD', ...byDay.map(d => `${d.day},${d.kgCO2},${Number(d.cost||0).toFixed(4)}`)].join('\n');
            // Per-day provider CSV
            const byDayProv = await CarbonEmissionEvent.aggregate([
              { $match: match },
              { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$windowEnd' } }, provider: '$provider' }, kgCO2: { $sum: '$estimatedCO2Kg' }, cost: { $sum: '$estimatedCost' } } },
              { $project: { _id: 0, day: '$_id.day', provider: '$_id.provider', kgCO2: { $round: ['$kgCO2', 4] }, cost: { $round: ['$cost', 4] } } },
              { $sort: { day: 1, provider: 1 } }
            ]);
            const byDayProvCsv = ['day,provider,kgCO2,costUSD', ...byDayProv.map(r => `${r.day},${r.provider},${r.kgCO2},${Number(r.cost||0).toFixed(4)}`)].join('\n');

            // Optional inline sparkline SVG (controlled by WEEKLY_INLINE_CHART)
            let inlineChartHtml = '';
            if (String(process.env.WEEKLY_INLINE_CHART || 'true').toLowerCase() === 'true' && byDay.length) {
              const max = Math.max(...byDay.map(d=>d.kgCO2));
              const pts = byDay.map((d,i)=>({ x: i*(120/Math.max(1,(byDay.length-1))), y: 30 - (max? (d.kgCO2/max)*28 : 0) - 1 }));
              const path = pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
              inlineChartHtml = `<svg width="120" height="30" viewBox="0 0 120 30"><path d="${path}" fill="none" stroke="#2e7d32" stroke-width="2"/></svg>`;
            }
            const listHtml = byDay.map(d => `<li>${d.day}: ${d.kgCO2} kg, $${Number(d.cost||0).toFixed(2)}</li>`).join('');
            const html = `
              <div style="font-family:Arial,sans-serif;line-height:1.5;">
                <h2 style="margin:0 0 8px;">Weekly Cloud Summary</h2>
                <p>Total 7-day emissions: ${totalKg} kg CO₂ | Cost: $${Number(totalCost).toFixed(2)}</p>
                ${inlineChartHtml}
                <ul>${listHtml}</ul>
                <p style="font-size:12px;color:#666;">Generated at ${new Date().toLocaleString()}</p>
              </div>`;
            await emailService.sendEmail({
              to: u.email,
              subject: 'Weekly Cloud Summary — GreenVision Cloud',
              html,
              text: `7d Emissions: ${totalKg} kg CO2 | Cost: $${Number(totalCost).toFixed(2)}`,
              attachments: [
                { filename: `weekly_trend_${new Date().toISOString().slice(0,10)}.csv`, content: trendCsv, contentType: 'text/csv' },
                { filename: `weekly_by_provider_${new Date().toISOString().slice(0,10)}.csv`, content: byDayProvCsv, contentType: 'text/csv' }
              ]
            });
            await EmailDeliveryLog.create({ userId: u._id, email: u.email, type: 'weekly', status: 'sent', attempts: attempt, meta: { totalKg, totalCost }, sentAt: new Date() });
            sent = true;
          } catch (e) {
            lastErr = e;
            // exponential backoff: 1s, 2s
            await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt-1)));
          }
        }
        if (!sent && adminEmails.length) {
          try {
            await emailService.sendEmail({
              to: adminEmails,
              subject: 'Weekly Summary send failed for a user',
              text: `User ${u._id} (${u.email}) failed after 3 attempts. Error: ${lastErr?.message}`
            });
          } catch {}
          try { await EmailDeliveryLog.create({ userId: u._id, email: u.email, type: 'weekly', status: 'failed', attempts: 3, error: lastErr?.message, sentAt: new Date() }); } catch {}
        }
      }
    } catch (err) {
      if ((process.env.ADMIN_EMAILS || '').length) {
        try { await emailService.sendEmail({ to: (process.env.ADMIN_EMAILS || '').split(',').map(s=>s.trim()).filter(Boolean), subject: 'Weekly Summary job failed', text: err.message }); } catch {}
      }
    }
  });

  // Schedule weekly summary (default Monday 08:00)
  const weeklyCron = process.env.WEEKLY_SUMMARY_CRON || '0 8 * * 1';
  await agendaInstance.every(weeklyCron, 'notifications:weekly-summary');
  return agendaInstance;
}

export function getAgenda() {
  return agendaInstance;
}
