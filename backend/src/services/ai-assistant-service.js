// src/services/ai-assistant-service.js
import aiRecommendationService from './ai-recommendation-service.js';
import CloudMetrics from '../models/CloudMetrics.js';
import AwsIssueLog from '../models/AwsIssueLog.js';
import AzureIssueLog from '../models/AzureIssueLog.js';
import GcpIssueLog from '../models/GcpIssueLog.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import emailService from './email-service.js';

function detectIntent(message) {
	const m = (message || '').toLowerCase();
	if (/recommend|suggest|optimi(s|z)e|save|reduce/.test(m)) return 'recommendations';
	if (/status|health|uptime|availability/.test(m)) return 'status';
	if (/(cost|spend|bill)/.test(m)) return 'cost';
	if (/(carbon|emission|co2)/.test(m)) return 'carbon';
	if (/(aws|azure|gcp).*log|error|warn/.test(m) || /logs?/.test(m)) return 'logs';
	if (/email|mail|send.*summary/.test(m)) return 'email';
	return 'general';
}

async function getLatestMetrics(userId) {
	try {
		const uid = new mongoose.Types.ObjectId(userId);
		const provs = ['aws', 'azure', 'gcp'];
		const docs = await Promise.all(provs.map(async (p) => ({ p, d: await CloudMetrics.findOne({ userId: uid, provider: p }).sort({ timestamp: -1 }).lean() })));
		const byProv = {};
		docs.forEach(({ p, d }) => { if (d) byProv[p] = d; });
		const summary = provs.reduce((acc, p) => {
			const d = byProv[p];
			acc[p] = d ? {
				avgCPU: d?.metrics?.summary?.avgCPU || 0,
				totalInstances: d?.metrics?.totalInstances || 0,
				cost: d?.cost || 0,
				carbon: d?.carbonFootprint || 0,
				timestamp: d?.timestamp,
			} : null;
			return acc;
		}, {});
		const totals = Object.values(summary).filter(Boolean).reduce((a, s) => ({
			cost: (a.cost || 0) + (s.cost || 0),
			carbon: (a.carbon || 0) + (s.carbon || 0),
			instances: (a.instances || 0) + (s.totalInstances || 0),
		}), {});
		return { byProv: summary, totals };
	} catch (e) {
		return { byProv: {}, totals: {} };
	}
}

async function getRecentIssues(userId) {
	try {
		const uid = new mongoose.Types.ObjectId(userId);
		const since = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h
		const baseQuery = { timestamp: { $gte: since }, $or: [{ userId: uid }, { userId: null }] };

		const [aws, azure, gcp] = await Promise.all([
			AwsIssueLog.find(baseQuery).sort({ timestamp: -1 }).limit(200).lean(),
			AzureIssueLog.find(baseQuery).sort({ timestamp: -1 }).limit(200).lean(),
			GcpIssueLog.find(baseQuery).sort({ timestamp: -1 }).limit(200).lean(),
		]);

		const tag = (arr, provider) => arr.map(x => ({ ...x, provider }));
		const combined = [...tag(aws, 'aws'), ...tag(azure, 'azure'), ...tag(gcp, 'gcp')]
			.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

		const sumLevels = (arr) => arr.reduce((a, l) => {
			const k = (l.level || 'info').toLowerCase();
			a[k] = (a[k] || 0) + 1;
			return a;
		}, {});

		const byProvider = {
			aws: { total: aws.length, levels: sumLevels(aws) },
			azure: { total: azure.length, levels: sumLevels(azure) },
			gcp: { total: gcp.length, levels: sumLevels(gcp) },
		};

		const levels = sumLevels(combined);
		return {
			total: combined.length,
			levels,
			byProvider,
			sample: combined.slice(0, 10),
		};
	} catch {
		return { total: 0, levels: {}, byProvider: { aws: { total: 0, levels: {} }, azure: { total: 0, levels: {} }, gcp: { total: 0, levels: {} } }, sample: [] };
	}
}

class AIAssistantService {
	async getContextSummary({ userId }) {
		const [metrics, rec] = await Promise.all([
			getLatestMetrics(userId),
			aiRecommendationService.generateRecommendations(userId).catch(() => ({ recommendations: [] })),
		]);
		const issues = await getRecentIssues(userId);
		return {
			metrics: metrics.byProv,
			totals: metrics.totals,
			recommendations: rec.recommendations?.slice(0, 5) || [],
			issues,
			generatedAt: new Date().toISOString(),
		};
	}

	async respond({ userId, message, history = [] }) {
		const intent = detectIntent(message);
		if (intent === 'recommendations') {
			const rec = await aiRecommendationService.generateRecommendations(userId);
			return { intent, reply: 'Here are the top recommendations:', recommendations: rec.recommendations, logSummary: rec.logSummary || null };
		}
		if (intent === 'status' || intent === 'cost' || intent === 'carbon') {
			const ctx = await this.getContextSummary({ userId });
			return { intent, reply: 'Here is your latest summary.', context: ctx };
		}
		if (intent === 'logs') {
			const issues = await getRecentIssues(userId);
			return { intent, reply: `Found ${issues.total} recent issue logs`, issues };
		}
		if (intent === 'email') {
			const sent = await this.emailRecommendations({ userId });
			return { intent, reply: sent?.message || 'Emailed the latest summary to you.', emailed: true };
		}
		// general -> combine
		const ctx = await this.getContextSummary({ userId });
		return { intent, reply: 'How can I help? Here is your latest snapshot.', context: ctx };
	}

	async emailRecommendations({ userId }) {
		const rec = await aiRecommendationService.generateRecommendations(userId);
		const top = rec.recommendations.slice(0, 5);
		const user = await User.findById(userId).lean();
		const to = user?.email;
		if (!to) return { ok: false, message: 'No user email on file' };

		const html = `
			<div style="font-family: Arial, sans-serif">
				<h2>AI Assistant Summary</h2>
				<p>Here are your top recommendations:</p>
				<ol>
					${top.map(r => `<li><b>${r.type}</b>: ${r.description} ${r.potentialSavings ? `(~$${r.potentialSavings}/mo)` : ''}</li>`).join('')}
				</ol>
				${rec.logSummary ? `<p><b>Issues (last window):</b> ${rec.logSummary?.total || 0}</p>` : ''}
				<p style="font-size:12px;color:#666">Sent on ${new Date().toLocaleString()}</p>
			</div>`;
			await emailService.sendEmail({ to, subject: 'Your AI Assistant Summary', html, text: 'AI Assistant Summary' });
		return { ok: true, message: 'Email sent', count: top.length };
	}

	async resetContext({ userId }) {
		// Placeholder: If we later persist conversation context or caches, clear them here.
		// For now, just return ok; front-end will also clear local history.
		return { ok: true, message: 'Assistant context reset' };
	}
}

export default new AIAssistantService();
