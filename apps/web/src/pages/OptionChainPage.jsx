import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import useTradingStore from '@/store/tradingStore';
import { useAngelOneSync } from '@/hooks/useAngelOneSync';
import { getLatestOptionChain } from '@/db/indexedDB';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, RefreshCw, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const OptionChainPage = () => {
  const { currentSymbol, currentExpiry, isOffline, lastUpdateTime, angelOneConnected } = useTradingStore();
  const { fetchOptionChain } = useAngelOneSync();
  
  const [optionChain, setOptionChain] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  useEffect(() => {
    loadData();
  }, [currentSymbol, currentExpiry]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!isOffline) {
        await fetchOptionChain(currentSymbol, currentExpiry);
      }
      const data = await getLatestOptionChain(currentSymbol);
      if (data) {
        setOptionChain(data);
      }
    } catch (error) {
      console.error('Error loading option chain:', error);
      // If live fetch fails, try to get local
      const localData = await getLatestOptionChain(currentSymbol);
      if (localData) setOptionChain(localData);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    toast.promise(loadData(), {
      loading: 'Fetching live option chain...',
      success: 'Option chain updated',
      error: 'Failed to update. Using cached data.'
    });
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedStrikes = () => {
    if (!optionChain?.strikes) return [];
    
    const sorted = [...optionChain.strikes];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        const aVal = a[sortConfig.key] || 0;
        const bVal = b[sortConfig.key] || 0;
        
        if (sortConfig.direction === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
    }
    return sorted;
  };

  const exportToCSV = () => {
    if (!optionChain?.strikes) return;
    
    const headers = ['Strike', 'CE OI', 'PE OI', 'CE LTP', 'PE LTP', 'CE IV', 'PE IV'];
    const rows = optionChain.strikes.map(s => [
      s.strike,
      s.ce_oi || 0,
      s.pe_oi || 0,
      s.ce_ltp || 0,
      s.pe_ltp || 0,
      s.ce_iv || 0,
      s.pe_iv || 0
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `option_chain_${currentSymbol}_${new Date().toISOString()}.csv`;
    a.click();
    toast.success('Option chain exported');
  };

  const getHighestOI = (type) => {
    if (!optionChain?.strikes || optionChain.strikes.length === 0) return null;
    return optionChain.strikes.reduce((max, s) => 
      (s[type] || 0) > (max[type] || 0) ? s : max
    );
  };

  const sortedStrikes = getSortedStrikes();
  // Guess ATM by finding strike closest to average of CE and PE LTPs or simple middle
  const atmStrike = sortedStrikes.length > 0 ? sortedStrikes[Math.floor(sortedStrikes.length / 2)]?.strike : null;

  return (
    <>
      <Helmet>
        <title>Option Chain - Options Terminal</title>
        <meta name="description" content="Live option chain data with OI analysis" />
      </Helmet>

      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground" style={{ letterSpacing: '-0.02em' }}>
                Option Chain
              </h1>
              {angelOneConnected ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Live</Badge>
              ) : (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Cached</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              {currentSymbol} • Expiry: <span className="font-semibold text-foreground">{optionChain?.expiry || currentExpiry}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2 hidden sm:inline">
              Updated: {lastUpdateTime ? format(new Date(lastUpdateTime), 'HH:mm:ss') : '--:--'}
            </span>
            <Button onClick={handleManualRefresh} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={exportToCSV} variant="secondary">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {isOffline && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 px-4 flex items-center gap-3 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-destructive">Showing cached data. Live connection to Angel One is currently unavailable.</span>
          </div>
        )}

        <Card className="overflow-hidden border-border shadow-md">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="cursor-pointer text-xs font-semibold" onClick={() => handleSort('ce_oi')}>
                      CE OI
                    </TableHead>
                    <TableHead className="cursor-pointer text-xs font-semibold" onClick={() => handleSort('ce_ltp')}>
                      CE LTP
                    </TableHead>
                    <TableHead className="cursor-pointer text-xs font-semibold" onClick={() => handleSort('ce_iv')}>
                      CE IV
                    </TableHead>
                    <TableHead className="text-center font-bold cursor-pointer text-xs uppercase tracking-wider text-primary" onClick={() => handleSort('strike')}>
                      Strike
                    </TableHead>
                    <TableHead className="cursor-pointer text-xs font-semibold" onClick={() => handleSort('pe_iv')}>
                      PE IV
                    </TableHead>
                    <TableHead className="cursor-pointer text-xs font-semibold" onClick={() => handleSort('pe_ltp')}>
                      PE LTP
                    </TableHead>
                    <TableHead className="cursor-pointer text-xs font-semibold text-right" onClick={() => handleSort('pe_oi')}>
                      PE OI
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && !optionChain ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={7} className="p-4">
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : sortedStrikes.length > 0 ? (
                    sortedStrikes.map((strike) => {
                      const isATM = strike.strike === atmStrike;
                      const highestCE = getHighestOI('ce_oi');
                      const highestPE = getHighestOI('pe_oi');
                      
                      return (
                        <TableRow key={strike.strike} className={`${isATM ? 'bg-primary/5' : ''} hover:bg-muted/50 transition-colors`}>
                          <TableCell className={`font-mono text-sm ${strike.strike === highestCE?.strike ? 'bg-price-down/10 text-price-down font-medium' : ''}`}>
                            {(strike.ce_oi || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{(strike.ce_ltp || 0).toFixed(2)}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{(strike.ce_iv || 0).toFixed(1)}%</TableCell>
                          
                          <TableCell className={`text-center font-bold font-mono ${isATM ? 'text-primary border-x border-primary/20 bg-primary/10' : 'bg-muted/30 border-x border-border'}`}>
                            {strike.strike}
                          </TableCell>
                          
                          <TableCell className="font-mono text-sm text-muted-foreground">{(strike.pe_iv || 0).toFixed(1)}%</TableCell>
                          <TableCell className="font-mono text-sm">{(strike.pe_ltp || 0).toFixed(2)}</TableCell>
                          <TableCell className={`font-mono text-sm text-right ${strike.strike === highestPE?.strike ? 'bg-price-up/10 text-price-up font-medium' : ''}`}>
                            {(strike.pe_oi || 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        No option chain data available for {currentSymbol}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default OptionChainPage;