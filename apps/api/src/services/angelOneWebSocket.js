import 'dotenv/config';
import WebSocket from 'ws';
import { getAuthToken, isTokenExpired } from './angelOneAuth.js';
import logger from '../utils/logger.js';

const BASE_URL = process.env.ANGEL_ONE_BASE_URL;
const API_KEY = process.env.ANGEL_ONE_API_KEY;

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

const subscribedSymbols = new Set();
const connectedClients = new Set();

/**
 * Calculate exponential backoff delay
 */
function getReconnectDelay() {
	const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
	return Math.min(delay, MAX_RECONNECT_DELAY);
}

/**
 * Handle WebSocket connection
 */
async function setupWebSocket() {
	try {
		// Check if token is expired
		if (isTokenExpired()) {
			logger.error('Authentication token is expired, cannot connect to WebSocket');
			throw new Error('Authentication token is expired. Please login again.');
		}

		const jwtToken = getAuthToken();

		if (!jwtToken) {
			logger.error('No authentication token available for WebSocket connection');
			throw new Error('No authentication token available. Please login first.');
		}

		const wsUrl = `${BASE_URL.replace('https', 'wss')}/rest/secure/angelbroking/market/v1/quote/`;

		logger.info('Connecting to Angel One WebSocket');

		ws = new WebSocket(wsUrl, {
			headers: {
				'Authorization': `Bearer ${jwtToken}`,
				'X-PrivateKey': API_KEY,
			},
		});

		ws.on('open', () => {
			logger.info('Angel One WebSocket connected');
			reconnectAttempts = 0;

			// Resubscribe to previously subscribed symbols
			subscribedSymbols.forEach((symbol) => {
				sendSubscriptionMessage(symbol);
			});
		});

		ws.on('message', (data) => {
			try {
				const message = JSON.parse(data);
				broadcastToClients(message);
			} catch (error) {
				logger.error('Failed to parse WebSocket message:', error.message);
			}
		});

		ws.on('error', (error) => {
			logger.error('Angel One WebSocket error:', error.message);
		});

		ws.on('close', () => {
			logger.warn('Angel One WebSocket disconnected');
			ws = null;

			if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
				const delay = getReconnectDelay();
				reconnectAttempts++;
				logger.info(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
				setTimeout(() => setupWebSocket(), delay);
			} else {
				logger.error('Max WebSocket reconnection attempts reached');
			}
		});
	} catch (error) {
		logger.error('Failed to setup WebSocket:', error.message);
		throw error;
	}
}

/**
 * Send subscription message for a symbol
 */
function sendSubscriptionMessage(symbol) {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		logger.warn(`WebSocket not ready, cannot subscribe to ${symbol}`);
		return;
	}

	const message = {
		mode: 'LTP',
		exchangeTokens: {
			NSE_OPT: [symbol],
		},
	};

	try {
		ws.send(JSON.stringify(message));
		logger.debug(`Subscribed to ${symbol}`);
	} catch (error) {
		logger.error(`Failed to subscribe to ${symbol}:`, error.message);
	}
}

/**
 * Broadcast message to all connected clients
 */
function broadcastToClients(message) {
	connectedClients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN) {
			try {
				client.send(JSON.stringify(message));
			} catch (error) {
				logger.error('Failed to send message to client:', error.message);
			}
		}
	});
}

/**
 * Connect to Angel One WebSocket
 */
export async function connectWebSocket() {
	if (ws && ws.readyState === WebSocket.OPEN) {
		logger.debug('WebSocket already connected');
		return;
	}

	await setupWebSocket();
}

/**
 * Disconnect from Angel One WebSocket
 */
export function disconnectWebSocket() {
	if (ws) {
		logger.info('Disconnecting from Angel One WebSocket');
		ws.close();
		ws = null;
	}

	subscribedSymbols.clear();
	connectedClients.clear();
}

/**
 * Subscribe to a symbol
 */
export async function subscribeToSymbol(symbol) {
	if (!symbol) {
		throw new Error('Symbol is required');
	}

	if (!ws || ws.readyState !== WebSocket.OPEN) {
		await connectWebSocket();
	}

	subscribedSymbols.add(symbol);
	sendSubscriptionMessage(symbol);

	logger.info(`Subscribed to symbol: ${symbol}`);
}

/**
 * Unsubscribe from a symbol
 */
export function unsubscribeFromSymbol(symbol) {
	if (!symbol) {
		throw new Error('Symbol is required');
	}

	subscribedSymbols.delete(symbol);

	if (!ws || ws.readyState !== WebSocket.OPEN) {
		logger.warn(`WebSocket not ready, cannot unsubscribe from ${symbol}`);
		return;
	}

	const message = {
		mode: 'UNSUBSCRIBE',
		exchangeTokens: {
			NSE_OPT: [symbol],
		},
	};

	try {
		ws.send(JSON.stringify(message));
		logger.info(`Unsubscribed from symbol: ${symbol}`);
	} catch (error) {
		logger.error(`Failed to unsubscribe from ${symbol}:`, error.message);
	}
}

/**
 * Register a client for real-time updates
 */
export function registerClient(client) {
	if (!client) {
		throw new Error('Client is required');
	}

	connectedClients.add(client);
	logger.debug('Client registered for real-time updates');

	return () => {
		connectedClients.delete(client);
		logger.debug('Client unregistered from real-time updates');
	};
}

/**
 * Get WebSocket connection status
 */
export function getConnectionStatus() {
	return {
		isConnected: ws && ws.readyState === WebSocket.OPEN,
		subscribedSymbols: Array.from(subscribedSymbols),
		connectedClients: connectedClients.size,
	};
}