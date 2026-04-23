// src/controllers/AiAssistantController.js
import aiAssistantService from '../services/ai-assistant-service.js';

export const chat = async (req, res) => {
	try {
		const userId = req.user?.id;
		const { message, history = [] } = req.body || {};
		if (!message || typeof message !== 'string') {
			return res.status(400).json({ success: false, message: 'message is required' });
		}
		const reply = await aiAssistantService.respond({ userId, message, history });
		return res.json({ success: true, data: reply });
	} catch (e) {
		console.error('AI Assistant chat error:', e);
		return res.status(500).json({ success: false, message: 'Assistant error', error: e.message });
	}
};

export const getContext = async (req, res) => {
	try {
		const userId = req.user?.id;
		const ctx = await aiAssistantService.getContextSummary({ userId });
		return res.json({ success: true, data: ctx });
	} catch (e) {
		console.error('AI Assistant context error:', e);
		return res.status(500).json({ success: false, message: 'Failed to load context', error: e.message });
	}
};

export const emailSummary = async (req, res) => {
	try {
		const userId = req.user?.id;
		const result = await aiAssistantService.emailRecommendations({ userId });
		return res.json({ success: true, data: result });
	} catch (e) {
		console.error('AI Assistant email error:', e);
		return res.status(500).json({ success: false, message: 'Failed to email summary', error: e.message });
	}
};

export const reset = async (req, res) => {
	try {
		const userId = req.user?.id;
		const result = await aiAssistantService.resetContext({ userId });
		return res.json({ success: true, data: result });
	} catch (e) {
		console.error('AI Assistant reset error:', e);
		return res.status(500).json({ success: false, message: 'Failed to reset assistant', error: e.message });
	}
};

export default { chat, getContext, emailSummary, reset };
