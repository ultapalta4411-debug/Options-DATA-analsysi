import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import useTradingStore from '@/store/tradingStore';
import { useAngelOneSync } from '@/hooks/useAngelOneSync';
import { getPCRHistory, getIVHistory, savePCRData, saveIVData } from '@/db/indexedDB';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const PCRIVPage = () => {
  const { currentSymbol, currentExpiry, isOffline, angelOneConnected } = useTradingStore();
  const { fetchPCR, fetchIV } = useAngelOneSync();
  
  const [pcrHistory, setPcrHistory] = useState([]);
  const [ivHistory, setIvHistory] = useState([]);
  const [currentPCR, setCurrentPCR] = useState(null);
  const [currentIV, setCurrentIV] = useState(null);
  const [loading, setLoading] = useState(false);

  // Manual entry form state
  const [manualPCR, setManualPCR] = useState('');
  const [manualATMIV, setManualATMIV] = useState('');

  useEffect(() => {
    loadData();
  }, [currentSymbol, currentExpiry]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!isOffline) {
        await Promise.allSettled([
          fetchPCR(currentSymbol, currentExpiry),
          fetchIV(currentSymbol, currentExpiry)
        ]);
      }
      
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const [pcr, iv] = await Promise.all([
        getPCRHistory(currentSymbol, startOfDay, endOfDay),
        getIVHistory(currentSymbol, startOfDay, endOfDay)
      ]);

      setPcrHistory(pcr || []);
      setIvHistory(iv || []);

      if (pcr && pcr.length > 0) {
        setCurrentPCR(pcr[pcr.length - 1]);
      }
      if (iv && iv.length > 0) {
        setCurrentIV(iv[iv.length - 1]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = () => {
    toast.promise(loadData(), {
      loading: 'Refreshing PCR & IV data...',
      success: 'Data updated',
      error: 'Refresh failed'
    });
  };

  const handleSaveManualData = async () => {
    if (manualPCR) {
      await savePCRData({ symbol: currentSymbol, pcr: parseFloat(manualPCR), ce_oi: 0, pe_oi: 0 });
    }
    if (manualATMIV) {
      await saveIVData({ symbol: currentSymbol, atm_iv: parseFloat(manualATMIV), ce_iv: 0, pe_iv: 0 });
    }
    setManualPCR('');
    setManualATMIV('');
    toast.success('Manual snapshot saved');
    loadData();
  };

  const getPCRSignal = (pcr) => {
    if (!pcr) return 'neutral';
    if (pcr > 1.2) return 'bullish';
    if (pcr < 0.8) return 'bearish';
    return 'neutral';
  };

  const getIVStatus = (iv) => {
    if (!iv) return 'normal';
    if (iv > 25) return 'high';
    if (iv < 15) return 'low';
    return 'normal';
  };

  const pcrChartData = pcrHistory.map(item => ({
    time: new Date(item.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    pcr: item.pcr
  }));

  const ivChartData = ivHistory.map(item => ({
    time: new Date(item.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    atm_iv: item.atm_iv,
    ce_iv: item.ce_iv || item.atm_iv, 
    pe_iv: item.pe_iv || item.atm_iv
  }));

  return (
    <>
      <Helmet>
        <title>PCR & IV Analysis - Options Terminal</title>
        <meta name="description" content="Put-Call Ratio and Implied Volatility tracking" />
      </Helmet>

      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground" style={{ letterSpacing: '-0.02em' }}>
                PCR & IV Analysis
              </h1>
              {angelOneConnected ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Live</Badge>
              ) : (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Cached</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              Real-time trend analysis for <span className="font-semibold text-foreground">{currentSymbol}</span>
            </p>
          </div>
          <Button onClick={handleManualRefresh} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Charts
          </Button>
        </div>

        {isOffline && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 px-4 flex items-center gap-3 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-destructive">Showing cached intraday history. Live connection unavailable.</span>
          </div>
        )}

        {/* PCR Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                PCR Tracker
              </CardTitle>
              <CardDescription>Intraday Put-Call Ratio trend</CardDescription>
            </CardHeader>
            <CardContent>
              {pcrChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={pcrChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} dy={10} />
                    <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                    <Line type="monotone" dataKey="pcr" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[320px] flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg bg-muted/10">
                  No intraday PCR data recorded yet.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-md">
              <CardHeader className="pb-4">
                <CardTitle>Current PCR</CardTitle>
                <CardDescription>Latest Snapshot</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-6">
                  <div className="text-5xl font-bold font-mono text-foreground tracking-tighter">
                    {currentPCR?.pcr?.toFixed(2) || '--'}
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`mt-3 ${
                      getPCRSignal(currentPCR?.pcr) === 'bullish' 
                        ? 'bg-price-up/10 text-price-up border-price-up/20'
                        : getPCRSignal(currentPCR?.pcr) === 'bearish'
                        ? 'bg-price-down/10 text-price-down border-price-down/20'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {getPCRSignal(currentPCR?.pcr).toUpperCase()} BIAS
                  </Badge>
                </div>

                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Total Call OI</span>
                    <span className="font-mono font-medium text-foreground">{currentPCR?.ce_oi?.toLocaleString() || '--'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Total Put OI</span>
                    <span className="font-mono font-medium text-foreground">{currentPCR?.pe_oi?.toLocaleString() || '--'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick entry for offline/testing */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Manual Override</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="number" step="0.01" placeholder="PCR value"
                    value={manualPCR} onChange={(e) => setManualPCR(e.target.value)}
                    className="bg-background h-8 text-sm"
                  />
                  <Input
                    type="number" step="0.1" placeholder="IV value"
                    value={manualATMIV} onChange={(e) => setManualATMIV(e.target.value)}
                    className="bg-background h-8 text-sm"
                  />
                </div>
                <Button onClick={handleSaveManualData} size="sm" variant="secondary" className="w-full">
                  Record Snapshot
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* IV Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-secondary" />
                IV Tracker
              </CardTitle>
              <CardDescription>Implied Volatility Intraday Comparison</CardDescription>
            </CardHeader>
            <CardContent>
              {ivChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={ivChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} dy={10} />
                    <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Line type="monotone" dataKey="atm_iv" stroke="hsl(var(--primary))" strokeWidth={2} name="ATM IV" dot={false} />
                    <Line type="monotone" dataKey="ce_iv" stroke="hsl(var(--price-down))" strokeWidth={1} strokeDasharray="5 5" name="CE IV" dot={false} />
                    <Line type="monotone" dataKey="pe_iv" stroke="hsl(var(--price-up))" strokeWidth={1} strokeDasharray="5 5" name="PE IV" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[320px] flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg bg-muted/10">
                  No intraday IV data recorded yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="pb-4">
              <CardTitle>Current IV</CardTitle>
              <CardDescription>ATM Implied Volatility</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-6">
                <div className="text-5xl font-bold font-mono text-foreground tracking-tighter">
                  {currentIV?.atm_iv?.toFixed(1) || '--'}<span className="text-2xl text-muted-foreground ml-1">%</span>
                </div>
                <Badge 
                  variant="outline" 
                  className={`mt-3 ${
                    getIVStatus(currentIV?.atm_iv) === 'high' 
                      ? 'bg-alert-high/10 text-alert-high border-alert-high/20'
                      : getIVStatus(currentIV?.atm_iv) === 'low'
                      ? 'bg-alert-low/10 text-alert-low border-alert-low/20'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {getIVStatus(currentIV?.atm_iv).toUpperCase()} REGIME
                </Badge>
              </div>

              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Call Side IV</span>
                  <span className="font-mono font-medium text-foreground">{currentIV?.ce_iv?.toFixed(1) || '--'}%</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Put Side IV</span>
                  <span className="font-mono font-medium text-foreground">{currentIV?.pe_iv?.toFixed(1) || '--'}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default PCRIVPage;