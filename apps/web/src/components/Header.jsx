import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import useTradingStore from '@/store/tradingStore';
import { useAngelOneSync } from '@/hooks/useAngelOneSync';
import { dataSyncService } from '@/services/dataSyncService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, LogOut, Settings, Menu, Activity, DatabaseBackup } from 'lucide-react';
import { format } from 'date-fns';

const Header = ({ onMenuClick }) => {
  const { currentUser, logout, isAuthenticated } = useAuth();
  const { 
    currentSymbol, 
    setCurrentSymbol, 
    timeframe, 
    setTimeframe,
    angelOneConnected,
    isOffline,
    lastUpdateTime,
    autoRefreshInterval,
    currentExpiry
  } = useTradingStore();

  const syncHook = useAngelOneSync();

  const symbols = ['BANKNIFTY', 'NIFTY50', 'SENSEX'];
  const timeframes = ['1m', '5m', '15m', '1H', '1D'];

  // Start background sync when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      dataSyncService.startSync(autoRefreshInterval, syncHook);
    } else {
      dataSyncService.stopSync();
    }
    
    return () => dataSyncService.stopSync();
  }, [isAuthenticated, autoRefreshInterval]);

  // Trigger sync on symbol change
  useEffect(() => {
    if (isAuthenticated) {
      syncHook.fetchAllData(currentSymbol, currentExpiry);
    }
  }, [currentSymbol, currentExpiry]);

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Activity className="text-primary-foreground h-5 w-5" />
            </div>
            <span className="font-bold text-lg text-foreground hidden sm:inline">
              Options Terminal
            </span>
          </Link>

          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-3 ml-4 border-l border-border pl-4">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${angelOneConnected ? 'bg-emerald-500' : 'bg-destructive'}`} />
                <span className="text-xs font-medium text-muted-foreground">
                  {angelOneConnected ? 'Angel One Connected' : 'Offline Mode'}
                </span>
              </div>
              
              {angelOneConnected ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] h-5 px-1.5">
                  LIVE
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] h-5 px-1.5 flex gap-1 items-center">
                  <DatabaseBackup className="h-3 w-3" /> CACHED
                </Badge>
              )}
            </div>
          )}
        </div>

        {isAuthenticated ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:block text-xs text-muted-foreground mr-2 text-right">
              <div>Last Update</div>
              <div className="font-mono">
                {lastUpdateTime ? format(new Date(lastUpdateTime), 'HH:mm:ss') : '--:--:--'}
              </div>
            </div>

            <Select value={currentSymbol} onValueChange={setCurrentSymbol}>
              <SelectTrigger className="w-[120px] sm:w-[140px] bg-background h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {symbols.map((symbol) => (
                  <SelectItem key={symbol} value={symbol}>
                    {symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-[70px] sm:w-[90px] bg-background h-9 hidden sm:flex">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeframes.map((tf) => (
                  <SelectItem key={tf} value={tf}>
                    {tf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-sm text-muted-foreground break-all">
                  {currentUser?.email}
                </div>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default Header;