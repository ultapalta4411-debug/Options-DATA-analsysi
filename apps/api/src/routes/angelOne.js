import express from 'express';
import {
	generateLoginRedirectURL,
	loginWithSmartAPI,
	handleOAuthCallback,
	storeAuthToken,
	getValidToken,
	refreshToken,
	getTokenStatus,
	clearToken,
} from '../services/angelOneAuth.js';
import logger from '../utils/logger.js';

const router = express.Router();

const API_KEY = process.env.ANGEL_ONE_API_KEY;
const API_SECRET = process.env.ANGEL_ONE_API_SECRET;

/**
 * GET /angel-one/login
 * Generate Angel One SmartAPI login redirect URL
 * Redirects user to Angel One login page with embedded credentials
 * According to SmartAPI documentation: https://smartapi.angelone.in/docs
 */
router.get('/login', async (req, res) => {
	logger.info('Login endpoint called');

	const redirectUrl = generateLoginRedirectURL(API_KEY, API_SECRET);

	logger.info('Redirecting to Angel One login page');
	res.redirect(redirectUrl);
});

/**
 * GET /angel-one/callback
 * Handle OAuth callback from Angel One
 * Receives authentication token/code from Angel One
 * Stores token and redirects to frontend dashboard
 */
router.get('/callback', async (req, res) => {
	const { code, token, jwtToken, userId } = req.query;

	logger.info('OAuth callback received from Angel One');
	logger.debug(`Callback params: code=${code}, token=${token ? 'present' : 'absent'}, userId=${userId}`);

	if (!code && !token && !jwtToken) {
		logger.error('No authentication code or token in callback');
		return res.status(400).json({
			error: 'No authentication code or token received from Angel One',
		});
	}

	// Prepare callback data from query parameters
	const callbackData = {
		code,
		// Include other params for fallback
		token: token || jwtToken,
		jwtToken: token || jwtToken,
		expiresIn: parseInt(req.query.expiresIn) || 3600,
	};

	// Process OAuth callback
	const authResult = await handleOAuthCallback(callbackData);

	// Generate or use provided userId
	const finalUserId = userId || `user_${Date.now()}`;

	// Store token securely
	await storeAuthToken(finalUserId, authResult.token, authResult.expiresAt, authResult.refreshToken, authResult.feedToken);

	logger.info(`Token stored for user: ${finalUserId}`);

	// Redirect to frontend dashboard with token in query parameter
	// In development, frontend is at localhost:3000
	const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
	const dashboardUrl = `${frontendUrl}/dashboard?token=${encodeURIComponent(authResult.token)}&userId=${encodeURIComponent(finalUserId)}&expiresAt=${authResult.expiresAt}`;

	logger.info(`Redirecting to dashboard: ${dashboardUrl}`);
	res.redirect(dashboardUrl);
});

/**
 * GET /angel-one/status
 * Get current authentication status
 * Returns authentication state and token expiry information
 */
router.get('/status', async (req, res) => {
	const { userId } = req.query;

	if (!userId) {
		return res.status(400).json({
			error: 'userId query parameter is required',
		});
	}

	logger.info(`Status check for user: ${userId}`);

	const status = getTokenStatus(userId);

	res.json(status);
});

/**
 * GET /angel-one/token
 * Retrieve valid token for user
 * Returns token if valid, null if expired
 */
router.get('/token', async (req, res) => {
	const { userId } = req.query;

	if (!userId) {
		return res.status(400).json({
			error: 'userId query parameter is required',
		});
	}

	logger.info(`Token retrieval for user: ${userId}`);

	const tokenData = getValidToken(userId);

	if (!tokenData) {
		logger.warn(`No valid token found for user: ${userId}`);
		return res.json({
			isValid: false,
			token: null,
			userId,
		});
	}

	res.json({
		isValid: true,
		token: tokenData.token,
		expiresAt: tokenData.expiresAt,
		expiresIn: tokenData.expiresIn,
		userId,
	});
});

/**
 * POST /angel-one/refresh
 * Refresh authentication token
 * Attempts to refresh token using Angel One API
 */
router.post('/refresh', async (req, res) => {
	const { userId } = req.body;

	if (!userId) {
		return res.status(400).json({
			error: 'userId is required in request body',
		});
	}

	logger.info(`Token refresh requested for user: ${userId}`);

	const refreshResult = await refreshToken(userId);

	res.json({
		success: true,
		token: refreshResult.token,
		expiresAt: refreshResult.expiresAt,
		expiresIn: refreshResult.expiresIn,
		userId,
	});
});

/**
 * POST /angel-one/logout
 * Clear stored authentication token
 * Logs out user by removing token from storage
 */
router.post('/logout', async (req, res) => {
	const { userId } = req.body;

	if (!userId) {
		return res.status(400).json({
			error: 'userId is required in request body',
		});
	}

	logger.info(`Logout requested for user: ${userId}`);

	const cleared = clearToken(userId);

	res.json({
		success: cleared,
		message: cleared ? `User ${userId} logged out successfully` : `Failed to logout user ${userId}`,
		userId,
	});
});

export default router;