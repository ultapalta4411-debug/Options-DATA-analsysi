import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import useTradingStore from '@/store/tradingStore';
import { useAngelOneSync } from '@/hooks/useAngelOneSync';
import { getGreeksHistory } from '@/db/indexedDB';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Zap, Clock, AlertTriangle, Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const GreeksPage = () => {
  const { currentSymbol, currentExpiry, isOffline, angelOneConnected } = useTradingStore();
  const { fetchGreeks } = useAngelOneSync();
  
  const [greeksHistory, setGreeksHistory] = useState([]);
  const [currentGreeks, setCurrentGreeks] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentSymbol, currentExpiry]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!isOffline) {
        await fetchGreeks(currentSymbol, currentExpiry);
      }
      
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const greeks = await getGreeksHistory(currentSymbol, startOfDay, endOfDay);
      setGreeksHistory(greeks || []);

      if (greeks && greeks.length > 0) {
        setCurrentGreeks(greeks[greeks.length - 1]);
      }
    } catch (error) {
      console.error('Error loading Greeks data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = () => {
    toast.promise(loadData(), {
      loading: 'Refreshing Greeks...',
      success: 'Greeks updated',
      error: 'Refresh failed'
    });
  };

  // Mock gamma heatmap since backend only returns ATM greeks summary for now
  const gammaHeatmapData = [
    { strike: 'ATM-4', gamma: 0.003, zone: 'low' },
    { strike: 'ATM-3', gamma: 0.008, zone: 'medium' },
    { strike: 'ATM-2', gamma: 0.015, zone: 'high' },
    { strike: 'ATM-1', gamma: 0.024, zone: 'high' },
    { strike: 'ATM', gamma: currentGreeks?.gamma || 0.031, zone: 'squeeze' },
    { strike: 'ATM+1', gamma: 0.026, zone: 'high' },
    { strike: 'ATM+2', gamma: 0.017, zone: 'high' },
    { strike: 'ATM+3', gamma: 0.009, zone: 'medium' },
    { strike: 'ATM+4', gamma: 0.004, zone: 'low' },
  ];

  const getGammaColor = (zone) => {
    switch (zone) {
      case 'squeeze': return 'hsl(var(--primary))';
      case 'high': return 'hsl(var(--alert-high))';
      case 'medium': return 'hsl(var(--secondary))';
      default: return 'hsl(var(--muted))';
    }
  };

  const thetaDecayData = greeksHistory.slice(-10).map(item => ({
    time: new Date(item.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    theta: Math.abs(item.theta || 0)
  }));

  return (
    <>
      <Helmet>
        <title>Greeks Analysis - Options Terminal</title>
        <meta name="description" content="Gamma and Theta analysis for options trading" />
      </Helmet>

      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground" style={{ letterSpacing: '-0.02em' }}>
                Greeks Analysis
              </h1>
              {angelOneConnected ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Live</Badge>
              ) : (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Cached</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              Exposure and decay tracking for <span className="font-semibold text-foreground">{currentSymbol}</span>
            </p>
          </div>
          <Button onClick={handleManualRefresh} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {isOffline && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 px-4 flex items-center gap-3 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-destructive">Showing cached data. Live connection unavailable.</span>
          </div>
        )}

        {/* Current ATM Greeks Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ATM Gamma</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold font-mono text-foreground">
                {currentGreeks?.gamma?.toFixed(4) || '0.0000'}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ATM Theta</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold font-mono text-price-down">
                {currentGreeks?.theta?.toFixed(4) || '0.0000'}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ATM Delta</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold font-mono text-foreground">
                {currentGreeks?.delta?.toFixed(4) || '0.0000'}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ATM Vega</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold font-mono text-primary">
                {currentGreeks?.vega?.toFixed(4) || '0.0000'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gamma Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Gamma Profile (Estimated)
              </CardTitle>
              <CardDescription>Gamma exposure across strike prices</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={gammaHeatmapData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="strike" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} dy={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                  />
                  <Bar dataKey="gamma" radius={[4, 4, 0, 0]}>
                    {gammaHeatmapData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getGammaColor(entry.zone)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-6 flex flex-wrap gap-3">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  <Zap className="h-3 w-3 mr-1" /> Peak Gamma
                </Badge>
                <Badge variant="outline" className="bg-alert-high/10 text-alert-high border-alert-high/20">
                  High Risk Zone
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Theta Section */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-secondary" />
                Theta Decay Analysis
              </CardTitle>
              <CardDescription>Intraday time decay tracking</CardDescription>
            </CardHeader>
            <CardContent>
              {thetaDecayData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={thetaDecayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} dy={10} />
                    <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="theta" fill="hsl(var(--price-down))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg bg-muted/10">
                  Not enough history to chart decay.
                </div>
              )}

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/50 rounded-xl border border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Hourly Decay Est.</div>
                  <div className="text-xl font-bold font-mono text-foreground">
                    {currentGreeks?.theta ? (currentGreeks.theta / 24).toFixed(4) : '--'}
                  </div>
                </div>

                <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20 flex flex-col justify-center">
                  <div className="text-xs text-destructive uppercase tracking-wider mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Fast Decay Window
                  </div>
                  <div className="text-sm font-bold text-destructive">
                    Active (Near Expiry)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default GreeksPage;