import 'dotenv/config';
import axios from 'axios';
import { getAuthToken, isTokenExpired } from './angelOneAuth.js';
import logger from '../utils/logger.js';

const BASE_URL = process.env.ANGEL_ONE_BASE_URL;
const API_KEY = process.env.ANGEL_ONE_API_KEY;

/**
 * Create axios instance with Angel One authentication
 */
async function createAuthenticatedClient() {
	try {
		logger.debug('Creating authenticated client for Angel One API');

		// Check if token is expired
		if (isTokenExpired()) {
			logger.error('Authentication token is expired');
			throw new Error('Authentication token is expired. Please login again.');
		}

		const jwtToken = getAuthToken();

		if (!jwtToken) {
			throw new Error('Failed to obtain authentication token. Please login first.');
		}

		logger.debug(`JWT Token obtained: ${jwtToken.substring(0, 20)}...`);

		const client = axios.create({
			baseURL: `${BASE_URL}/rest/secure`,
			headers: {
				'Authorization': `Bearer ${jwtToken}`,
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			timeout: 15000,
		});

		return client;
	} catch (error) {
		logger.error('Failed to create authenticated client');
		logger.error(`Error: ${error.message}`);
		throw error;
	}
}

/**
 * Fetch option chain data for a symbol
 */
export async function getOptionChain(symbol, expiry) {
	if (!symbol || !expiry) {
		throw new Error('Symbol and expiry are required');
	}

	try {
		logger.info(`Fetching option chain for ${symbol} with expiry ${expiry}`);

		const client = await createAuthenticatedClient();

		const requestUrl = '/angelbroking/market/v1/optionchain/';
		const params = {
			mode: 'LTP',
			exchangeTokens: JSON.stringify({
				NSE_OPT: [symbol],
			}),
		};

		logger.debug(`Request URL: ${requestUrl}`);
		logger.debug(`Request params: ${JSON.stringify(params)}`);

		const response = await client.get(requestUrl, { params });

		logger.debug(`Option chain response status: ${response.status}`);

		if (!response.data) {
			logger.error('Empty response from Angel One option chain endpoint');
			throw new Error('Empty response from Angel One option chain endpoint');
		}

		logger.debug(`Option chain response: ${JSON.stringify(response.data).substring(0, 500)}...`);

		if (response.data.status === false || response.data.code !== 0) {
			const errorMsg = response.data.message || 'Failed to fetch option chain';
			logger.error(`Angel One option chain error: ${errorMsg}`);
			logger.error(`Full response: ${JSON.stringify(response.data)}`);
			throw new Error(`Angel One option chain error: ${errorMsg}`);
		}

		if (!response.data.data) {
			logger.error('Invalid response structure from Angel One option chain endpoint');
			logger.error(`Response: ${JSON.stringify(response.data)}`);
			throw new Error('Invalid response structure from Angel One option chain endpoint');
		}

		const optionChainData = response.data.data;
		logger.info(`Successfully fetched option chain for ${symbol}`);
		return transformOptionChainData(optionChainData, symbol, expiry);
	} catch (error) {
		logger.error(`Failed to fetch option chain for ${symbol}`);
		logger.error(`Error message: ${error.message}`);

		if (error.response) {
			logger.error(`HTTP Status: ${error.response.status}`);
			logger.error(`Response headers: ${JSON.stringify(error.response.headers)}`);
			logger.error(`Response body: ${JSON.stringify(error.response.data)}`);
		} else if (error.request) {
			logger.error('No response received from Angel One API');
		}

		throw new Error(`Failed to fetch option chain: ${error.message}`);
	}
}

/**
 * Calculate Put-Call Ratio from live data
 */
export async function getPCR(symbol, expiry) {
	if (!symbol || !expiry) {
		throw new Error('Symbol and expiry are required');
	}

	try {
		logger.info(`Calculating PCR for ${symbol} with expiry ${expiry}`);

		const optionChain = await getOptionChain(symbol, expiry);

		let totalCEOI = 0;
		let totalPEOI = 0;

		if (Array.isArray(optionChain)) {
			optionChain.forEach((strike) => {
				if (strike.ce && strike.ce.openInterest) {
					totalCEOI += strike.ce.openInterest;
				}
				if (strike.pe && strike.pe.openInterest) {
					totalPEOI += strike.pe.openInterest;
				}
			});
		}

		const pcr = totalCEOI > 0 ? totalPEOI / totalCEOI : 0;

		logger.info(`PCR calculated: ${pcr.toFixed(4)}`);

		return {
			symbol,
			expiry,
			pcr: parseFloat(pcr.toFixed(4)),
			totalCEOI,
			totalPEOI,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		logger.error(`Failed to calculate PCR for ${symbol}`);
		logger.error(`Error: ${error.message}`);
		throw new Error(`Failed to calculate PCR: ${error.message}`);
	}
}

/**
 * Fetch IV (Implied Volatility) data
 */
export async function getIV(symbol, expiry) {
	if (!symbol || !expiry) {
		throw new Error('Symbol and expiry are required');
	}

	try {
		logger.info(`Fetching IV data for ${symbol} with expiry ${expiry}`);

		const optionChain = await getOptionChain(symbol, expiry);

		const ivData = [];

		if (Array.isArray(optionChain)) {
			optionChain.forEach((strike) => {
				const strikeData = {
					strike: strike.strike,
				};

				if (strike.ce) {
					strikeData.ceIV = strike.ce.iv || 0;
				}

				if (strike.pe) {
					strikeData.peIV = strike.pe.iv || 0;
				}

				ivData.push(strikeData);
			});
		}

		// Calculate IV percentile
		const allIVs = ivData
			.flatMap((s) => [s.ceIV, s.peIV])
			.filter((iv) => iv > 0)
			.sort((a, b) => a - b);

		const ivPercentile = allIVs.length > 0
			? (allIVs[Math.floor(allIVs.length * 0.5)] / Math.max(...allIVs)) * 100
			: 0;

		logger.info(`IV percentile calculated: ${ivPercentile.toFixed(2)}`);

		return {
			symbol,
			expiry,
			ivPercentile: parseFloat(ivPercentile.toFixed(2)),
			strikes: ivData,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		logger.error(`Failed to fetch IV data for ${symbol}`);
		logger.error(`Error: ${error.message}`);
		throw new Error(`Failed to fetch IV data: ${error.message}`);
	}
}

/**
 * Calculate Greeks (Gamma, Theta, Delta, Vega)
 */
export async function getGreeks(symbol, expiry) {
	if (!symbol || !expiry) {
		throw new Error('Symbol and expiry are required');
	}

	try {
		logger.info(`Calculating Greeks for ${symbol} with expiry ${expiry}`);

		const optionChain = await getOptionChain(symbol, expiry);

		const greeksData = [];

		if (Array.isArray(optionChain)) {
			optionChain.forEach((strike) => {
				const strikeGreeks = {
					strike: strike.strike,
				};

				if (strike.ce) {
					strikeGreeks.ce = {
						delta: strike.ce.delta || 0,
						gamma: strike.ce.gamma || 0,
						theta: strike.ce.theta || 0,
						vega: strike.ce.vega || 0,
					};
				}

				if (strike.pe) {
					strikeGreeks.pe = {
						delta: strike.pe.delta || 0,
						gamma: strike.pe.gamma || 0,
						theta: strike.pe.theta || 0,
						vega: strike.pe.vega || 0,
					};
				}

				greeksData.push(strikeGreeks);
			});
		}

		logger.info(`Greeks calculated for ${greeksData.length} strikes`);

		return {
			symbol,
			expiry,
			strikes: greeksData,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		logger.error(`Failed to calculate Greeks for ${symbol}`);
		logger.error(`Error: ${error.message}`);
		throw new Error(`Failed to calculate Greeks: ${error.message}`);
	}
}

/**
 * Get available symbols (BankNifty, Nifty50, Sensex)
 */
export async function getSymbols() {
	try {
		logger.info('Fetching available symbols');

		const symbols = [
			{
				name: 'BankNifty',
				token: 'BANKNIFTY',
				exchange: 'NSE',
				type: 'INDEX',
			},
			{
				name: 'Nifty50',
				token: 'NIFTY',
				exchange: 'NSE',
				type: 'INDEX',
			},
			{
				name: 'Sensex',
				token: 'SENSEX',
				exchange: 'BSE',
				type: 'INDEX',
			},
		];

		logger.info(`Symbols fetched: ${symbols.length} available`);
		return symbols;
	} catch (error) {
		logger.error('Failed to fetch symbols');
		logger.error(`Error: ${error.message}`);
		throw new Error(`Failed to fetch symbols: ${error.message}`);
	}
}

/**
 * Transform Angel One option chain response to app schema
 */
function transformOptionChainData(data, symbol, expiry) {
	const transformed = [];

	if (!data || typeof data !== 'object') {
		logger.warn('Invalid option chain data structure');
		return transformed;
	}

	// Handle different response formats from Angel One
	const strikes = Array.isArray(data) ? data : data.strikes || [];

	logger.debug(`Transforming ${strikes.length} strikes`);

	strikes.forEach((strikeData) => {
		const strike = {
			strike: strikeData.strike || strikeData.strikePrice || 0,
			expiry,
		};

		// Process Call option data
		if (strikeData.CE || strikeData.ce) {
			const ceData = strikeData.CE || strikeData.ce;
			strike.ce = {
				ltp: ceData.ltp || ceData.lastPrice || 0,
				bid: ceData.bid || ceData.bidPrice || 0,
				ask: ceData.ask || ceData.askPrice || 0,
				openInterest: ceData.oi || ceData.openInterest || 0,
				volume: ceData.volume || 0,
				iv: ceData.iv || ceData.impliedVolatility || 0,
				delta: ceData.delta || 0,
				gamma: ceData.gamma || 0,
				theta: ceData.theta || 0,
				vega: ceData.vega || 0,
			};
		}

		// Process Put option data
		if (strikeData.PE || strikeData.pe) {
			const peData = strikeData.PE || strikeData.pe;
			strike.pe = {
				ltp: peData.ltp || peData.lastPrice || 0,
				bid: peData.bid || peData.bidPrice || 0,
				ask: peData.ask || peData.askPrice || 0,
				openInterest: peData.oi || peData.openInterest || 0,
				volume: peData.volume || 0,
				iv: peData.iv || peData.impliedVolatility || 0,
				delta: peData.delta || 0,
				gamma: peData.gamma || 0,
				theta: peData.theta || 0,
				vega: peData.vega || 0,
			};
		}

		transformed.push(strike);
	});

	return transformed;
}