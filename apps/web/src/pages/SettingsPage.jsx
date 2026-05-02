import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import useTradingStore from '@/store/tradingStore';
import { useAngelOneSync } from '@/hooks/useAngelOneSync';
import { dataSyncService } from '@/services/dataSyncService';
import AngelOneConnectionStatus from '@/components/AngelOneConnectionStatus.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import apiServerClient from '@/lib/apiServerClient';

const SettingsPage = () => {
  const { currentUser, saveBrokerCredentials, getBrokerCredentials, updateUserSettings } = useAuth();
  const { settings, updateSettings, autoRefreshInterval, setAutoRefreshInterval, currentSymbol, currentExpiry } = useTradingStore();
  const { checkConnectionStatus, fetchAllData, loading: syncLoading } = useAngelOneSync();

  // Broker credentials (Legacy API Key)
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [brokerName, setBrokerName] = useState('Angel One');
  const [testStatus, setTestStatus] = useState(null);

  // OAuth Connection State
  const [oauthConnected, setOauthConnected] = useState(false);
  const [oauthExpiresAt, setOauthExpiresAt] = useState(null);

  // User settings
  const [refreshFreqStr, setRefreshFreqStr] = useState(autoRefreshInterval.toString());
  const [pcrHigh, setPcrHigh] = useState(settings.alertThresholds.pcrHigh);
  const [pcrLow, setPcrLow] = useState(settings.alertThresholds.pcrLow);
  const [ivHigh, setIvHigh] = useState(settings.alertThresholds.ivHigh);
  const [ivLow, setIvLow] = useState(settings.alertThresholds.ivLow);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBrokerCredentials();
    checkOAuthStatus();
  }, []);

  const checkOAuthStatus = async () => {
    const userId = localStorage.getItem('angelOneUserId');
    if (!userId) return;
    
    try {
      const res = await apiServerClient.fetch(`/angel-one/status?userId=${userId}`);
      const data = await res.json();
      if (data.isAuthenticated) {
        setOauthConnected(true);
        if (data.expiresAt) {
          setOauthExpiresAt(new Date(parseInt(data.expiresAt)).toLocaleString());
        }
      } else {
        setOauthConnected(false);
      }
    } catch (e) {
      console.error('Failed to check OAuth status', e);
    }
  };

  const handleConnectOAuth = async () => {
    try {
      const response = await apiServerClient.fetch('/angel-one/login');
      const data = await response.json();
      if (data && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
    } catch (err) {
      // Expected fallback if backend uses standard redirect and fetch fails due to CORS
    }
    // Fallback to direct navigation
    window.location.href = '/hcgi/api/angel-one/login';
  };

  const handleDisconnectOAuth = async () => {
    const userId = localStorage.getItem('angelOneUserId');
    if (!userId) return;
    
    try {
      await apiServerClient.fetch('/angel-one/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      localStorage.removeItem('angelOneUserId');
      localStorage.removeItem('angelOneToken');
      localStorage.removeItem('angelOneExpiresAt');
      setOauthConnected(false);
      setOauthExpiresAt(null);
      toast.success('Disconnected from Angel One');
    } catch (e) {
      toast.error('Failed to disconnect');
    }
  };

  const loadBrokerCredentials = async () => {
    try {
      const credentials = await getBrokerCredentials();
      if (credentials && credentials.length > 0) {
        const latest = credentials[0];
        setApiKey(latest.api_key);
        setApiSecret(latest.api_secret);
        setBrokerName(latest.broker_name);
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
    }
  };

  const handleSaveBrokerCredentials = async () => {
    if (!apiKey || !apiSecret) {
      toast.error('Please enter both API key and secret');
      return;
    }

    setLoading(true);
    try {
      await saveBrokerCredentials(apiKey, apiSecret, brokerName);
      toast.success('Broker credentials saved securely');
      setTestStatus(null);
    } catch (error) {
      toast.error('Failed to save credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setTestStatus(null);
    try {
      const status = await checkConnectionStatus();
      if (status.isConnected) {
        setTestStatus('success');
        toast.success('Successfully connected to Angel One');
      } else {
        setTestStatus('error');
        toast.error('Connection failed. Please check credentials or API server.');
      }
    } catch (err) {
      setTestStatus('error');
      toast.error('Connection test failed');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    try {
      await fetchAllData(currentSymbol, currentExpiry);
      toast.success('Manual data sync completed');
    } catch (error) {
      toast.error('Failed to sync data');
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const intervalSecs = parseInt(refreshFreqStr);
      setAutoRefreshInterval(intervalSecs);
      dataSyncService.setInterval(intervalSecs);

      const newSettings = {
        refreshFrequency: intervalSecs,
        alertThresholds: {
          pcrHigh: parseFloat(pcrHigh),
          pcrLow: parseFloat(pcrLow),
          ivHigh: parseFloat(ivHigh),
          ivLow: parseFloat(ivLow)
        }
      };

      updateSettings(newSettings);

      await updateUserSettings({
        refresh_frequency: intervalSecs,
        alert_thresholds: newSettings.alertThresholds
      });

      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Settings - Options Terminal</title>
        <meta name="description" content="Configure your trading terminal settings" />
      </Helmet>

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-foreground" style={{ letterSpacing: '-0.02em' }}>
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure integrations and trading terminal preferences
          </p>
        </div>

        {/* Connection Status Component */}
        <AngelOneConnectionStatus />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Broker Connections */}
          <Card>
            <CardHeader>
              <CardTitle>Angel One Connection</CardTitle>
              <CardDescription>
                Connect your broker account for live data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* OAuth Flow */}
              <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
                 <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                       <h3 className="font-medium flex items-center gap-2">
                          SmartAPI Login 
                          {oauthConnected ? (
                             <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500">Connected</span>
                          ) : (
                             <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Disconnected</span>
                          )}
                       </h3>
                       <p className="text-sm text-muted-foreground mt-1">
                          Authenticate directly with your broker securely.
                       </p>
                       {oauthConnected && oauthExpiresAt && (
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                             <Clock className="h-3.5 w-3.5" /> Token expires: {oauthExpiresAt}
                          </p>
                       )}
                    </div>
                    <div className="shrink-0">
                       {!oauthConnected ? (
                          <Button onClick={handleConnectOAuth} className="w-full sm:w-auto">Connect via Angel One</Button>
                       ) : (
                          <Button variant="outline" className="w-full sm:w-auto text-destructive border-destructive/20 hover:bg-destructive/10" onClick={handleDisconnectOAuth}>
                             Disconnect
                          </Button>
                       )}
                    </div>
                 </div>
              </div>

              <Separator />

              {/* Legacy API Key Inputs */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Legacy Setup (Optional)</h3>
                
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter SmartAPI Key"
                    className="bg-background text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label>API Secret</Label>
                  <Input
                    type="password"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="Enter SmartAPI Secret"
                    className="bg-background text-foreground"
                  />
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button 
                    onClick={handleSaveBrokerCredentials}
                    disabled={loading}
                  >
                    Save Credentials
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={handleTestConnection}
                    disabled={loading}
                  >
                    Test Local Key
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleManualSync}
                    disabled={syncLoading}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncLoading ? 'animate-spin' : ''}`} />
                    Manual Sync
                  </Button>
                </div>

                {testStatus === 'success' && (
                  <div className="flex items-center gap-2 text-sm text-emerald-500 mt-2 p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                    <CheckCircle2 className="h-4 w-4" /> Credentials validated successfully
                  </div>
                )}
                {testStatus === 'error' && (
                  <div className="flex items-center gap-2 text-sm text-destructive mt-2 p-2 bg-destructive/10 rounded border border-destructive/20">
                    <XCircle className="h-4 w-4" /> Validation failed. Check API server and credentials.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Data Refresh & Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Data & Alerts Configuration</CardTitle>
              <CardDescription>
                Set intervals and threshold levels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Auto-Refresh Interval</Label>
                <Select value={refreshFreqStr} onValueChange={setRefreshFreqStr}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">1 Minute (High Frequency)</SelectItem>
                    <SelectItem value="300">5 Minutes (Recommended)</SelectItem>
                    <SelectItem value="600">10 Minutes</SelectItem>
                    <SelectItem value="1800">30 Minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">PCR High Threshold</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={pcrHigh}
                    onChange={(e) => setPcrHigh(e.target.value)}
                    className="bg-background text-foreground h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">PCR Low Threshold</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={pcrLow}
                    onChange={(e) => setPcrLow(e.target.value)}
                    className="bg-background text-foreground h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">IV High Threshold (%)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={ivHigh}
                    onChange={(e) => setIvHigh(e.target.value)}
                    className="bg-background text-foreground h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">IV Low Threshold (%)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={ivLow}
                    onChange={(e) => setIvLow(e.target.value)}
                    className="bg-background text-foreground h-9"
                  />
                </div>
              </div>

              <Button 
                onClick={handleSaveSettings}
                disabled={loading}
                className="w-full"
              >
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default SettingsPage;