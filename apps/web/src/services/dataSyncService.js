import useTradingStore from '@/store/tradingStore';

class DataSyncService {
  constructor() {
    this.syncIntervalId = null;
    this.syncFunctions = null;
  }

  startSync(intervalSeconds, functions) {
    this.stopSync();
    
    if (functions) {
      this.syncFunctions = functions;
    }

    if (!this.syncFunctions) {
      console.warn('Sync functions not provided to DataSyncService');
      return;
    }

    const { currentSymbol, currentExpiry } = useTradingStore.getState();

    // Initial fetch
    this.executeSync(currentSymbol, currentExpiry);

    // Set interval
    const intervalMs = intervalSeconds * 1000;
    this.syncIntervalId = setInterval(() => {
      const state = useTradingStore.getState();
      this.executeSync(state.currentSymbol, state.currentExpiry);
    }, intervalMs);

    console.log(`Background sync started: every ${intervalSeconds}s`);
  }

  async executeSync(symbol, expiry) {
    if (!this.syncFunctions) return;
    
    try {
      await this.syncFunctions.fetchAllData(symbol, expiry);
    } catch (error) {
      console.error('Background sync failed. Falling back to cached data.', error);
      useTradingStore.getState().setIsOffline(true);
    }
  }

  stopSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
      console.log('Background sync stopped');
    }
  }

  getCurrentInterval() {
    return useTradingStore.getState().autoRefreshInterval;
  }

  setInterval(newIntervalSeconds) {
    useTradingStore.getState().setAutoRefreshInterval(newIntervalSeconds);
    if (this.syncIntervalId && this.syncFunctions) {
      this.startSync(newIntervalSeconds, this.syncFunctions);
    }
  }
}

export const dataSyncService = new DataSyncService();