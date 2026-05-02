import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger.js';

const API_KEY = process.env.ANGEL_ONE_API_KEY;
const API_SECRET = process.env.ANGEL_ONE_API_SECRET;
const BASE_URL = process.env.ANGEL_ONE_BASE_URL;

// In-memory token storage with expiry tracking
const tokenStore = new Map();

// Track the current authenticated user
let currentUserId = null;

/**
 * Generate SHA256 hash for authentication
 */
function generateHash(data) {
	return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate Angel One SmartAPI login redirect URL
 * Embeds credentials in the URL for OAuth flow
 */
export function generateLoginRedirectURL(apiKey, apiSecret) {
	if (!apiKey || !apiSecret) {
		throw new Error('API Key and API Secret are required for login redirect URL');
	}

	try {
		logger.info('Generating Angel One login redirect URL');
		logger.debug(`Using API Key: ${apiKey.substring(0, 4)}...`);

		// Angel One SmartAPI login endpoint
		// The login URL includes credentials for OAuth flow
		const loginUrl = `${BASE_URL}/rest/secure/login`;

		// Create redirect URL with embedded credentials
		// Angel One expects these parameters for OAuth flow
		const redirectUrl = `${loginUrl}?apiKey=${encodeURIComponent(apiKey)}&apiSecret=${encodeURIComponent(apiSecret)}`;

		logger.info('Login redirect URL generated successfully');
		logger.debug(`Redirect URL: ${redirectUrl.substring(0, 100)}...`);

		return redirectUrl;
	} catch (error) {
		logger.error('Failed to generate login redirect URL');
		logger.error(`Error: ${error.message}`);
		throw new Error(`Failed to generate login redirect URL: ${error.message}`);
	}
}

/**
 * Handle OAuth callback from Angel One
 * Extracts and validates authentication token from callback response
 */
export async function handleOAuthCallback(callbackData) {
	if (!callbackData) {
		throw new Error('Callback data is required');
	}

	try {
		logger.info('Processing Angel One OAuth callback');
		logger.debug(`Callback data: ${JSON.stringify(callbackData).substring(0, 200)}...`);

		// Extract token from callback
		// Angel One may return token in different formats:
		// - Direct token in response
		// - Authorization code that needs to be exchanged
		// - JWT token in data field
		const token = callbackData.jwtToken
			|| callbackData.token
			|| callbackData.authToken
			|| (callbackData.data && callbackData.data.jwtToken);

		if (!token) {
			logger.error('No authentication token found in callback data');
			logger.error(`Callback data: ${JSON.stringify(callbackData)}`);
			throw new Error('No authentication token found in callback response');
		}

		// Extract expiry information if available
		const expiresIn = callbackData.expiresIn
			|| callbackData.expires_in
			|| (callbackData.data && callbackData.data.expiresIn)
			|| 3600; // Default to 1 hour

		const expiresAt = Date.now() + (expiresIn * 1000);

		logger.info('OAuth callback processed successfully');
		logger.debug(`Token expires in: ${expiresIn} seconds`);

		return {
			token,
			expiresIn,
			expiresAt,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		logger.error('Failed to handle OAuth callback');
		logger.error(`Error: ${error.message}`);
		throw new Error(`Failed to handle OAuth callback: ${error.message}`);
	}
}

/**
 * Securely store authentication token with expiry tracking
 * Stores token in memory cache with user association
 */
export function storeAuthToken(userId, token, expiresAt) {
	if (!userId || !token || !expiresAt) {
		throw new Error('userId, token, and expiresAt are required');
	}

	try {
		logger.info(`Storing authentication token for user: ${userId}`);

		// Store token with metadata
		tokenStore.set(userId, {
			token,
			expiresAt,
			storedAt: Date.now(),
			isValid: true,
		});

		// Set as current user
		currentUserId = userId;

		logger.info(`Token stored successfully for user: ${userId}`);
		logger.debug(`Token expires at: ${new Date(expiresAt).toISOString()}`);

		return {
			success: true,
			userId,
			expiresAt,
		};
	} catch (error) {
		logger.error('Failed to store authentication token');
		logger.error(`Error: ${error.message}`);
		throw new Error(`Failed to store authentication token: ${error.message}`);
	}
}

/**
 * Retrieve valid authentication token for user
 * Returns null if token is expired or not found
 */
export function getValidToken(userId) {
	if (!userId) {
		logger.warn('userId is required to retrieve token');
		return null;
	}

	try {
		logger.debug(`Retrieving token for user: ${userId}`);

		const tokenData = tokenStore.get(userId);

		if (!tokenData) {
			logger.debug(`No token found for user: ${userId}`);
			return null;
		}

		// Check if token is expired
		if (Date.now() >= tokenData.expiresAt) {
			logger.warn(`Token expired for user: ${userId}`);
			tokenStore.delete(userId);
			return null;
		}

		logger.debug(`Valid token retrieved for user: ${userId}`);

		return {
			token: tokenData.token,
			expiresAt: tokenData.expiresAt,
			expiresIn: Math.floor((tokenData.expiresAt - Date.now()) / 1000),
		};
	} catch (error) {
		logger.error('Failed to retrieve token');
		logger.error(`Error: ${error.message}`);
		return null;
	}
}

/**
 * Get the current authenticated user's token
 * Returns the token for the most recently authenticated user
 * Used by services that don't have userId context
 */
export function getAuthToken() {
	if (!currentUserId) {
		logger.warn('No authenticated user found');
		return null;
	}

	try {
		logger.debug(`Retrieving auth token for current user: ${currentUserId}`);

		const tokenData = tokenStore.get(currentUserId);

		if (!tokenData) {
			logger.warn(`No token found for current user: ${currentUserId}`);
			return null;
		}

		// Check if token is expired
		if (Date.now() >= tokenData.expiresAt) {
			logger.warn(`Token expired for current user: ${currentUserId}`);
			tokenStore.delete(currentUserId);
			currentUserId = null;
			return null;
		}

		logger.debug(`Auth token retrieved for current user: ${currentUserId}`);

		return tokenData.token;
	} catch (error) {
		logger.error('Failed to retrieve auth token');
		logger.error(`Error: ${error.message}`);
		return null;
	}
}

/**
 * Check if the current user's token is expired
 * Returns true if token is expired or not found
 */
export function isTokenExpired() {
	if (!currentUserId) {
		logger.debug('No authenticated user found');
		return true;
	}

	try {
		const tokenData = tokenStore.get(currentUserId);

		if (!tokenData) {
			logger.debug(`No token found for current user: ${currentUserId}`);
			return true;
		}

		const isExpired = Date.now() >= tokenData.expiresAt;

		if (isExpired) {
			logger.debug(`Token expired for current user: ${currentUserId}`);
			tokenStore.delete(currentUserId);
		}

		return isExpired;
	} catch (error) {
		logger.error('Failed to check token expiry');
		logger.error(`Error: ${error.message}`);
		return true;
	}
}

/**
 * Get the current authenticated user ID
 */
export function getCurrentUserId() {
	return currentUserId;
}

/**
 * Set the current authenticated user ID
 */
export function setCurrentUserId(userId) {
	if (!userId) {
		logger.warn('userId is required to set current user');
		return false;
	}

	try {
		const tokenData = tokenStore.get(userId);

		if (!tokenData) {
			logger.warn(`No token found for user: ${userId}`);
			return false;
		}

		currentUserId = userId;
		logger.info(`Current user set to: ${userId}`);
		return true;
	} catch (error) {
		logger.error('Failed to set current user');
		logger.error(`Error: ${error.message}`);
		return false;
	}
}

/**
 * Refresh authentication token if Angel One supports it
 * Attempts to refresh token using stored credentials
 */
export async function refreshToken(userId) {
	if (!userId) {
		throw new Error('userId is required to refresh token');
	}

	try {
		logger.info(`Refreshing token for user: ${userId}`);

		const tokenData = tokenStore.get(userId);

		if (!tokenData) {
			logger.error(`No token found for user: ${userId}`);
			throw new Error(`No token found for user: ${userId}`);
		}

		// Attempt to refresh token via Angel One API
		const refreshUrl = `${BASE_URL}/rest/secure/refreshToken`;

		logger.debug(`Refresh URL: ${refreshUrl}`);

		const response = await axios.post(
			refreshUrl,
			{
				apiKey: API_KEY,
				apiSecret: API_SECRET,
			},
			{
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					'Authorization': `Bearer ${tokenData.token}`,
				},
				timeout: 15000,
			},
		);

		logger.debug(`Refresh response status: ${response.status}`);

		if (!response.data) {
			logger.error('Empty response from token refresh endpoint');
			throw new Error('Empty response from token refresh endpoint');
		}

		if (response.data.status === false || response.data.code !== 0) {
			const errorMsg = response.data.message || 'Token refresh failed';
			logger.error(`Token refresh error: ${errorMsg}`);
			throw new Error(`Token refresh failed: ${errorMsg}`);
		}

		const newToken = response.data.data?.jwtToken || response.data.jwtToken;

		if (!newToken) {
			logger.error('No new token received from refresh endpoint');
			throw new Error('No new token received from refresh endpoint');
		}

		const expiresIn = response.data.data?.expiresIn || response.data.expiresIn || 3600;
		const expiresAt = Date.now() + (expiresIn * 1000);

		// Update stored token
		tokenStore.set(userId, {
			token: newToken,
			expiresAt,
			storedAt: Date.now(),
			isValid: true,
		});

		logger.info(`Token refreshed successfully for user: ${userId}`);

		return {
			token: newToken,
			expiresAt,
			expiresIn,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		logger.error(`Failed to refresh token for user: ${userId}`);
		logger.error(`Error: ${error.message}`);

		if (error.response) {
			logger.error(`HTTP Status: ${error.response.status}`);
			logger.error(`Response body: ${JSON.stringify(error.response.data)}`);
		}

		throw new Error(`Failed to refresh token: ${error.message}`);
	}
}

/**
 * Clear stored token for user
 */
export function clearToken(userId) {
	if (!userId) {
		logger.warn('userId is required to clear token');
		return false;
	}

	try {
		logger.info(`Clearing token for user: ${userId}`);
		tokenStore.delete(userId);

		// Clear current user if it matches
		if (currentUserId === userId) {
			currentUserId = null;
		}

		logger.info(`Token cleared for user: ${userId}`);
		return true;
	} catch (error) {
		logger.error('Failed to clear token');
		logger.error(`Error: ${error.message}`);
		return false;
	}
}

/**
 * Get token expiry status for user
 */
export function getTokenStatus(userId) {
	if (!userId) {
		return {
			isAuthenticated: false,
			userId: null,
			expiresAt: null,
			expiresIn: null,
		};
	}

	try {
		const tokenData = tokenStore.get(userId);

		if (!tokenData) {
			return {
				isAuthenticated: false,
				userId,
				expiresAt: null,
				expiresIn: null,
			};
		}

		const isExpired = Date.now() >= tokenData.expiresAt;
		const expiresIn = Math.floor((tokenData.expiresAt - Date.now()) / 1000);

		return {
			isAuthenticated: !isExpired,
			userId,
			expiresAt: tokenData.expiresAt,
			expiresIn: isExpired ? 0 : expiresIn,
			isExpired,
		};
	} catch (error) {
		logger.error('Failed to get token status');
		logger.error(`Error: ${error.message}`);
		return {
			isAuthenticated: false,
			userId,
			expiresAt: null,
			expiresIn: null,
		};
	}
}