import { create } from 'zustand';

const useTradingStore = create((set) => ({
  // Selected symbol and timeframe
  currentSymbol: 'BANKNIFTY',
  timeframe: '1D',
  currentExpiry: '2024-01-25', // Default expiry for demo
  
  // Current data
  pcrData: null,
  ivData: null,
  greeksData: null,
  optionChainData: null,
  
  // Alerts
  alerts: [],
  
  // User settings
  settings: {
    refreshFrequency: 60, // seconds
    alertThresholds: {
      pcrHigh: 1.5,
      pcrLow: 0.5,
      ivHigh: 30,
      ivLow: 10
    }
  },
  
  // Connection and Sync Status
  autoRefreshInterval: 300, // 5 minutes in seconds
  angelOneConnected: false,
  lastUpdateTime: null,
  isOffline: false,
  
  // Actions
  setCurrentSymbol: (symbol) => set({ currentSymbol: symbol }),
  
  setCurrentExpiry: (expiry) => set({ currentExpiry: expiry }),
  
  setTimeframe: (timeframe) => set({ timeframe }),
  
  setPCRData: (data) => set({ pcrData: data }),
  
  setIVData: (data) => set({ ivData: data }),
  
  setGreeksData: (data) => set({ greeksData: data }),
  
  setOptionChainData: (data) => set({ optionChainData: data }),
  
  addAlert: (alert) => set((state) => ({
    alerts: [...state.alerts, { ...alert, id: Date.now(), timestamp: new Date().toISOString() }]
  })),
  
  removeAlert: (id) => set((state) => ({
    alerts: state.alerts.filter(alert => alert.id !== id)
  })),
  
  clearAlerts: () => set({ alerts: [] }),
  
  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),
  
  setAutoRefreshInterval: (interval) => set({ autoRefreshInterval: interval }),
  
  setAngelOneConnected: (status) => set({ angelOneConnected: status, isOffline: !status }),
  
  setLastUpdateTime: (time) => set({ lastUpdateTime: time }),
  
  setIsOffline: (status) => set({ isOffline: status }),
  
  // Reset all data
  resetData: () => set({
    pcrData: null,
    ivData: null,
    greeksData: null,
    optionChainData: null,
    alerts: []
  })
}));

export default useTradingStore;