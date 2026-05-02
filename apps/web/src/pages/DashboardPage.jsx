import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import useTradingStore from '@/store/tradingStore';
import { useAngelOneSync } from '@/hooks/useAngelOneSync';
import { getLatestPCR, getLatestIV, getLatestGreeks } from '@/db/indexedDB';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Activity, Zap, Target, BarChart3, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const DashboardPage = () => {
  const { currentSymbol, currentExpiry, isOffline, lastUpdateTime, angelOneConnected } = useTradingStore();
  const { fetchAllData, loading: syncLoading } = useAngelOneSync();
  
  const [loading, setLoading] = useState(true);
  const [pcrData, setPcrData] = useState(null);
  const [ivData, setIvData] = useState(null);
  const [greeksData, setGreeksData] = useState(null);

  useEffect(() => {
    const initDashboard = async () => {
      setLoading(true);
      // Try fetching live data first
      try {
        await fetchAllData(currentSymbol, currentExpiry);
      } catch (err) {
        console.log('Using fallback indexedDB data');
      }
      // Load whatever is in DB (updated or cached)
      await loadLocalData();
      setLoading(false);
    };

    initDashboard();
  }, [currentSymbol, currentExpiry, fetchAllData]);

  const loadLocalData = async () => {
    try {
      const [pcr, iv, greeks] = await Promise.all([
        getLatestPCR(currentSymbol),
        getLatestIV(currentSymbol),
        getLatestGreeks(currentSymbol)
      ]);
      setPcrData(pcr);
      setIvData(iv);
      setGreeksData(greeks);
    } catch (error) {
      console.error('Error loading local dashboard data:', error);
    }
  };

  const modules = [
    {
      title: 'PCR Tracker',
      description: 'Put-Call Ratio analysis',
      icon: TrendingUp,
      link: '/pcr-iv',
      value: pcrData?.pcr?.toFixed(2) || '--',
      status: pcrData?.pcr > 1.2 ? 'bullish' : pcrData?.pcr < 0.8 ? 'bearish' : 'neutral'
    },
    {
      title: 'Option Chain',
      description: 'Live option chain data',
      icon: Activity,
      link: '/option-chain',
      value: 'View Chain',
      status: 'neutral'
    },
    {
      title: 'IV Tracker',
      description: 'Implied Volatility monitor',
      icon: TrendingDown,
      link: '/pcr-iv',
      value: ivData?.atm_iv ? `${ivData.atm_iv.toFixed(1)}%` : '--',
      status: ivData?.atm_iv > 25 ? 'high' : ivData?.atm_iv < 15 ? 'low' : 'neutral'
    },
    {
      title: 'Greeks Tracker',
      description: 'Gamma & Theta analysis',
      icon: Zap,
      link: '/greeks',
      value: greeksData ? 'Active' : 'No Data',
      status: 'neutral'
    },
    {
      title: 'Premium Decay',
      description: 'Time decay heatmap',
      icon: Clock,
      link: '/analytics',
      value: 'View Map',
      status: 'neutral'
    },
    {
      title: 'Day Type Engine',
      description: 'Market classification',
      icon: Target,
      link: '/analytics',
      value: 'Trending',
      status: 'neutral'
    },
    {
      title: 'Gap Stats',
      description: 'Opening gap analysis',
      icon: BarChart3,
      link: '/analytics',
      value: '+0.47%',
      status: 'bullish'
    },
    {
      title: 'Signal Performance',
      description: 'Trading signals tracker',
      icon: AlertTriangle,
      link: '/signals',
      value: '67.3%',
      status: 'neutral'
    }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'bullish':
        return 'bg-price-up/10 text-price-up border-price-up/20';
      case 'bearish':
        return 'bg-price-down/10 text-price-down border-price-down/20';
      case 'high':
        return 'bg-alert-high/10 text-alert-high border-alert-high/20';
      case 'low':
        return 'bg-alert-low/10 text-alert-low border-alert-low/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const isDataLoading = loading || syncLoading;

  return (
    <>
      <Helmet>
        <title>Dashboard - Options Terminal</title>
        <meta name="description" content="Options trading dashboard with real-time analytics" />
      </Helmet>

      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground" style={{ letterSpacing: '-0.02em' }}>
                Dashboard
              </h1>
              {angelOneConnected ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Live • Angel One</Badge>
              ) : (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Offline • Cached</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              Real-time options analytics for <span className="font-semibold text-foreground">{currentSymbol}</span>
            </p>
          </div>
          
          <div className="text-sm text-muted-foreground bg-card px-3 py-1.5 rounded-lg border border-border">
            Last Sync: <span className="font-mono ml-1">{lastUpdateTime ? format(new Date(lastUpdateTime), 'HH:mm:ss') : '--:--'}</span>
          </div>
        </div>

        {isOffline && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-destructive">Offline Mode Active</h3>
              <p className="text-sm text-destructive/80 mt-1">
                Unable to connect to Angel One. Displaying cached data from local database. Check Settings to reconnect.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((module) => {
            const Icon = module.icon;
            
            return (
              <Link key={module.title} to={module.link} className="group outline-none">
                <Card className="h-full transition-all duration-200 group-hover:shadow-lg group-hover:border-primary/50 group-hover:-translate-y-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="p-2 bg-primary/10 rounded-lg transition-colors group-hover:bg-primary/20">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <Badge variant="outline" className={getStatusColor(module.status)}>
                        {module.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mt-3">{module.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {module.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isDataLoading && !pcrData ? (
                      <Skeleton className="h-8 w-24 rounded-md" />
                    ) : (
                      <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
                        {module.value}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default DashboardPage;