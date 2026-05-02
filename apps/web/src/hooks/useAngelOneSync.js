import { useState, useCallback } from 'react';
import apiServerClient from '@/lib/apiServerClient';
import { 
  saveOptionChainSnapshot, 
  savePCRData, 
  saveIVData, 
  saveGreeksData 
} from '@/db/indexedDB';
import useTradingStore from '@/store/tradingStore';
import { toast } from 'sonner';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const useAngelOneSync = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { 
    setOptionChainData, 
    setPCRData, 
    setIVData, 
    setGreeksData,
    setAngelOneConnected,
    setLastUpdateTime,
    setIsOffline
  } = useTradingStore();

  const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        const response = await apiServerClient.fetch(url, options);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        setAngelOneConnected(true);
        setIsOffline(false);
        return await response.json();
      } catch (err) {
        retries++;
        if (retries >= maxRetries) {
          setAngelOneConnected(false);
          setIsOffline(true);
          throw err;
        }
        await delay(Math.pow(2, retries) * 1000); // Exponential backoff: 2s, 4s, 8s...
      }
    }
  };

  const fetchOptionChain = useCallback(async (symbol, expiry) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithRetry(`/angel-one/option-chain?symbol=${symbol}&expiry=${expiry}`);
      
      // Backend returns array of strikes. Format for indexedDB and store.
      const formattedData = {
        symbol,
        expiry,
        strikes: data || []
      };
      
      await saveOptionChainSnapshot(formattedData);
      setOptionChainData(formattedData);
      setLastUpdateTime(new Date().toISOString());
      return formattedData;
    } catch (err) {
      console.error('Failed to fetch option chain:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPCR = useCallback(async (symbol, expiry) => {
    setLoading(true);
    try {
      const data = await fetchWithRetry(`/angel-one/pcr?symbol=${symbol}&expiry=${expiry}`);
      
      const formattedData = {
        symbol: data.symbol || symbol,
        pcr: data.pcr || 0,
        ce_oi: data.totalCEOI || 0,
        pe_oi: data.totalPEOI || 0,
      };
      
      await savePCRData(formattedData);
      setPCRData(formattedData);
      setLastUpdateTime(new Date().toISOString());
      return formattedData;
    } catch (err) {
      console.error('Failed to fetch PCR:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIV = useCallback(async (symbol, expiry) => {
    setLoading(true);
    try {
      const data = await fetchWithRetry(`/angel-one/iv?symbol=${symbol}&expiry=${expiry}`);
      
      // Calculate average CE/PE IV from strikes if needed, or use defaults
      const formattedData = {
        symbol: data.symbol || symbol,
        atm_iv: data.ivPercentile || 0,
        ce_iv: data.strikes?.[0]?.ce_iv || 0, // Simplified extraction
        pe_iv: data.strikes?.[0]?.pe_iv || 0
      };
      
      await saveIVData(formattedData);
      setIVData(formattedData);
      setLastUpdateTime(new Date().toISOString());
      return formattedData;
    } catch (err) {
      console.error('Failed to fetch IV:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGreeks = useCallback(async (symbol, expiry) => {
    setLoading(true);
    try {
      const data = await fetchWithRetry(`/angel-one/greeks?symbol=${symbol}&expiry=${expiry}`);
      
      // Pick middle strike for ATM greeks summary
      const atmStrike = data.strikes?.[Math.floor((data.strikes?.length || 0) / 2)];
      
      const formattedData = {
        symbol: data.symbol || symbol,
        gamma: atmStrike?.ce_gamma || 0,
        theta: atmStrike?.ce_theta || 0,
        delta: atmStrike?.ce_delta || 0,
        vega: atmStrike?.ce_vega || 0
      };
      
      await saveGreeksData(formattedData);
      setGreeksData(formattedData);
      setLastUpdateTime(new Date().toISOString());
      return formattedData;
    } catch (err) {
      console.error('Failed to fetch Greeks:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAvailableSymbols = useCallback(async () => {
    try {
      const data = await fetchWithRetry('/angel-one/symbols');
      return data || [];
    } catch (err) {
      console.error('Failed to fetch symbols:', err);
      return [];
    }
  }, []);

  const checkConnectionStatus = useCallback(async () => {
    try {
      const data = await fetchWithRetry('/angel-one/status', {}, 1);
      setAngelOneConnected(data.isConnected);
      setIsOffline(!data.isConnected);
      return data;
    } catch (err) {
      setAngelOneConnected(false);
      setIsOffline(true);
      return { isConnected: false };
    }
  }, []);

  const fetchAllData = useCallback(async (symbol, expiry) => {
    try {
      await Promise.allSettled([
        fetchOptionChain(symbol, expiry),
        fetchPCR(symbol, expiry),
        fetchIV(symbol, expiry),
        fetchGreeks(symbol, expiry)
      ]);
      setLastUpdateTime(new Date().toISOString());
    } catch (err) {
      console.error('Error in bulk fetch:', err);
    }
  }, [fetchOptionChain, fetchPCR, fetchIV, fetchGreeks]);

  return {
    fetchOptionChain,
    fetchPCR,
    fetchIV,
    fetchGreeks,
    getAvailableSymbols,
    checkConnectionStatus,
    fetchAllData,
    loading,
    error
  };
};