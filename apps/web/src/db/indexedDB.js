import Dexie from 'dexie';

// Initialize Dexie database
const db = new Dexie('TradingTerminalDB');

// Define schema
db.version(1).stores({
  option_chain_snapshots: '++id, timestamp, symbol, expiry',
  pcr_history: '++id, timestamp, symbol',
  iv_history: '++id, timestamp, symbol',
  greeks_history: '++id, timestamp, symbol',
  day_summary: '++id, date',
  signals: '++id, timestamp, signal_type',
  premium_decay: '++id, timestamp, symbol, strike',
  settings: 'key'
});

// Helper functions for option_chain_snapshots
export const saveOptionChainSnapshot = async (data) => {
  return await db.option_chain_snapshots.add({
    timestamp: new Date().toISOString(),
    symbol: data.symbol,
    expiry: data.expiry,
    strikes: data.strikes
  });
};

export const getOptionChainSnapshots = async (symbol, startDate, endDate) => {
  let query = db.option_chain_snapshots.where('symbol').equals(symbol);
  
  if (startDate && endDate) {
    query = query.and(item => {
      const itemDate = new Date(item.timestamp);
      return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
    });
  }
  
  return await query.toArray();
};

export const getLatestOptionChain = async (symbol) => {
  return await db.option_chain_snapshots
    .where('symbol').equals(symbol)
    .reverse()
    .first();
};

// Helper functions for pcr_history
export const savePCRData = async (data) => {
  return await db.pcr_history.add({
    timestamp: new Date().toISOString(),
    symbol: data.symbol,
    pcr: data.pcr,
    ce_oi: data.ce_oi,
    pe_oi: data.pe_oi
  });
};

export const getPCRHistory = async (symbol, startDate, endDate) => {
  let query = db.pcr_history.where('symbol').equals(symbol);
  
  if (startDate && endDate) {
    query = query.and(item => {
      const itemDate = new Date(item.timestamp);
      return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
    });
  }
  
  return await query.toArray();
};

export const getLatestPCR = async (symbol) => {
  return await db.pcr_history
    .where('symbol').equals(symbol)
    .reverse()
    .first();
};

// Helper functions for iv_history
export const saveIVData = async (data) => {
  return await db.iv_history.add({
    timestamp: new Date().toISOString(),
    symbol: data.symbol,
    atm_iv: data.atm_iv,
    ce_iv: data.ce_iv,
    pe_iv: data.pe_iv
  });
};

export const getIVHistory = async (symbol, startDate, endDate) => {
  let query = db.iv_history.where('symbol').equals(symbol);
  
  if (startDate && endDate) {
    query = query.and(item => {
      const itemDate = new Date(item.timestamp);
      return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
    });
  }
  
  return await query.toArray();
};

export const getLatestIV = async (symbol) => {
  return await db.iv_history
    .where('symbol').equals(symbol)
    .reverse()
    .first();
};

// Helper functions for greeks_history
export const saveGreeksData = async (data) => {
  return await db.greeks_history.add({
    timestamp: new Date().toISOString(),
    symbol: data.symbol,
    gamma: data.gamma,
    theta: data.theta,
    delta: data.delta,
    vega: data.vega
  });
};

export const getGreeksHistory = async (symbol, startDate, endDate) => {
  let query = db.greeks_history.where('symbol').equals(symbol);
  
  if (startDate && endDate) {
    query = query.and(item => {
      const itemDate = new Date(item.timestamp);
      return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
    });
  }
  
  return await query.toArray();
};

export const getLatestGreeks = async (symbol) => {
  return await db.greeks_history
    .where('symbol').equals(symbol)
    .reverse()
    .first();
};

// Helper functions for day_summary
export const saveDaySummary = async (data) => {
  return await db.day_summary.add({
    date: data.date,
    day_type: data.day_type,
    gap_percent: data.gap_percent,
    signals_count: data.signals_count
  });
};

export const getDaySummaries = async (startDate, endDate) => {
  return await db.day_summary
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
};

export const getDaySummary = async (date) => {
  return await db.day_summary.where('date').equals(date).first();
};

// Helper functions for signals
export const saveSignal = async (data) => {
  return await db.signals.add({
    timestamp: new Date().toISOString(),
    signal_type: data.signal_type,
    price: data.price,
    result: data.result || null,
    max_favorable: data.max_favorable || null,
    max_adverse: data.max_adverse || null,
    strategy_tag: data.strategy_tag || null
  });
};

export const getSignals = async (startDate, endDate, signalType = null) => {
  let query = db.signals;
  
  if (signalType) {
    query = query.where('signal_type').equals(signalType);
  }
  
  let results = await query.toArray();
  
  if (startDate && endDate) {
    results = results.filter(item => {
      const itemDate = new Date(item.timestamp);
      return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
    });
  }
  
  return results;
};

export const updateSignalResult = async (id, result, maxFavorable, maxAdverse) => {
  return await db.signals.update(id, {
    result,
    max_favorable: maxFavorable,
    max_adverse: maxAdverse
  });
};

// Helper functions for premium_decay
export const savePremiumDecay = async (data) => {
  return await db.premium_decay.add({
    timestamp: new Date().toISOString(),
    symbol: data.symbol,
    strike: data.strike,
    decay_rate: data.decay_rate
  });
};

export const getPremiumDecay = async (symbol, startDate, endDate) => {
  let query = db.premium_decay.where('symbol').equals(symbol);
  
  if (startDate && endDate) {
    query = query.and(item => {
      const itemDate = new Date(item.timestamp);
      return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
    });
  }
  
  return await query.toArray();
};

// Helper functions for settings
export const saveSetting = async (key, value) => {
  return await db.settings.put({ key, value });
};

export const getSetting = async (key) => {
  const setting = await db.settings.get(key);
  return setting ? setting.value : null;
};

export const getAllSettings = async () => {
  return await db.settings.toArray();
};

// Export database instance
export default db;