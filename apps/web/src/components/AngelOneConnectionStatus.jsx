import React, { useEffect, useState } from 'react';
import useTradingStore from '@/store/tradingStore';
import { useAngelOneSync } from '@/hooks/useAngelOneSync';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Wifi, WifiOff, Clock, Database } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const AngelOneConnectionStatus = () => {
  const { 
    angelOneConnected, 
    lastUpdateTime, 
    currentSymbol, 
    setCurrentSymbol,
    currentExpiry
  } = useTradingStore();
  
  const { checkConnectionStatus, getAvailableSymbols } = useAngelOneSync();
  const [symbols, setSymbols] = useState([{ name: 'BANKNIFTY' }, { name: 'NIFTY50' }, { name: 'SENSEX' }]);
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    // Load available symbols
    const loadSymbols = async () => {
      const data = await getAvailableSymbols();
      if (data && data.length > 0) {
        setSymbols(data);
      }
    };
    loadSymbols();

    // Initial check
    checkConnectionStatus();

    // Check status every 30 seconds
    const interval = setInterval(() => {
      checkConnectionStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [checkConnectionStatus, getAvailableSymbols]);

  // Update "time ago" string every minute
  useEffect(() => {
    if (!lastUpdateTime) return;
    
    const updateTime = () => {
      try {
        setTimeAgo(formatDistanceToNow(new Date(lastUpdateTime), { addSuffix: true }));
      } catch (e) {
        setTimeAgo('just now');
      }
    };
    
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [lastUpdateTime]);

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`relative flex h-3 w-3`}>
              {angelOneConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${angelOneConnected ? 'bg-emerald-500' : 'bg-destructive'}`}></span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground leading-none">
                {angelOneConnected ? 'Connected' : 'Disconnected'}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Database className="h-3 w-3" />
                Angel One SmartAPI
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none">
            <Select value={currentSymbol} onValueChange={setCurrentSymbol}>
              <SelectTrigger className="w-full sm:w-[160px] bg-background">
                <SelectValue placeholder="Select Symbol" />
              </SelectTrigger>
              <SelectContent>
                {symbols.map((sym) => (
                  <SelectItem key={sym.name} value={sym.name}>
                    {sym.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col items-end text-right hidden sm:flex">
            <Badge variant="outline" className={angelOneConnected ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-muted text-muted-foreground'}>
              {angelOneConnected ? 'Live Data' : 'Cached Data'}
            </Badge>
            {lastUpdateTime && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
                <Clock className="h-3 w-3" />
                Updated {timeAgo}
              </span>
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  );
};

export default AngelOneConnectionStatus;