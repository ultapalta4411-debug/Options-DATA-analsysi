import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { getSignals, saveSignal, updateSignalResult } from '@/db/indexedDB';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Target, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

const SignalsPage = () => {
  const [signals, setSignals] = useState([]);
  const [filteredSignals, setFilteredSignals] = useState([]);
  const [signalTypeFilter, setSignalTypeFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  // Manual entry form state
  const [signalType, setSignalType] = useState('');
  const [price, setPrice] = useState('');
  const [strategyTag, setStrategyTag] = useState('');

  useEffect(() => {
    loadSignals();
  }, []);

  useEffect(() => {
    filterSignals();
  }, [signals, signalTypeFilter]);

  const loadSignals = async () => {
    setLoading(true);
    try {
      const allSignals = await getSignals();
      setSignals(allSignals);
    } catch (error) {
      console.error('Error loading signals:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterSignals = () => {
    if (signalTypeFilter === 'all') {
      setFilteredSignals(signals);
    } else {
      setFilteredSignals(signals.filter(s => s.signal_type === signalTypeFilter));
    }
  };

  const handleSaveSignal = async () => {
    if (!signalType || !price) {
      toast.error('Please fill in signal type and price');
      return;
    }

    try {
      await saveSignal({
        signal_type: signalType,
        price: parseFloat(price),
        strategy_tag: strategyTag || null
      });
      toast('Signal saved');
      setSignalType('');
      setPrice('');
      setStrategyTag('');
      loadSignals();
    } catch (error) {
      toast.error('Failed to save signal');
    }
  };

  const calculatePerformance = () => {
    const completedSignals = signals.filter(s => s.result !== null);
    if (completedSignals.length === 0) return null;

    const wins = completedSignals.filter(s => s.result === 'win').length;
    const winRate = (wins / completedSignals.length) * 100;

    const signalTypes = [...new Set(completedSignals.map(s => s.signal_type))];
    const performanceByType = signalTypes.map(type => {
      const typeSignals = completedSignals.filter(s => s.signal_type === type);
      const typeWins = typeSignals.filter(s => s.result === 'win').length;
      return {
        type,
        winRate: (typeWins / typeSignals.length) * 100,
        count: typeSignals.length
      };
    });

    const bestType = performanceByType.reduce((max, curr) => 
      curr.winRate > max.winRate ? curr : max
    , performanceByType[0]);

    const worstType = performanceByType.reduce((min, curr) => 
      curr.winRate < min.winRate ? curr : min
    , performanceByType[0]);

    return {
      winRate,
      totalSignals: completedSignals.length,
      bestType,
      worstType,
      performanceByType
    };
  };

  const performance = calculatePerformance();

  return (
    <>
      <Helmet>
        <title>Signals - Options Terminal</title>
        <meta name="description" content="Trading signals tracking and performance analysis" />
      </Helmet>

      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground" style={{ letterSpacing: '-0.02em' }}>
            Trading Signals
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and analyze your trading signals
          </p>
        </div>

        {/* Performance Summary */}
        {performance && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {performance.winRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {performance.totalSignals} signals
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Best Strategy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-foreground">
                  {performance.bestType?.type || '--'}
                </div>
                <p className="text-xs text-price-up mt-1">
                  {performance.bestType?.winRate.toFixed(1)}% win rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Worst Strategy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-foreground">
                  {performance.worstType?.type || '--'}
                </div>
                <p className="text-xs text-price-down mt-1">
                  {performance.worstType?.winRate.toFixed(1)}% win rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Signals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {signals.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  All time
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Performance Chart */}
        {performance && performance.performanceByType.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Performance by Signal Type</CardTitle>
              <CardDescription>Win rate comparison across strategies</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={performance.performanceByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="type" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                    {performance.performanceByType.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.winRate >= 50 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Signals Table and Entry Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Signal History</CardTitle>
                <Select value={signalTypeFilter} onValueChange={setSignalTypeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="breakout">Breakout</SelectItem>
                    <SelectItem value="reversal">Reversal</SelectItem>
                    <SelectItem value="momentum">Momentum</SelectItem>
                    <SelectItem value="mean_reversion">Mean Reversion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Max Favorable</TableHead>
                      <TableHead>Max Adverse</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSignals.length > 0 ? (
                      filteredSignals.slice(-20).reverse().map((signal) => (
                        <TableRow key={signal.id}>
                          <TableCell className="text-sm">
                            {new Date(signal.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{signal.signal_type}</Badge>
                          </TableCell>
                          <TableCell className="font-mono">{signal.price}</TableCell>
                          <TableCell>
                            {signal.result ? (
                              <Badge 
                                variant="outline"
                                className={
                                  signal.result === 'win' 
                                    ? 'bg-price-up/10 text-price-up border-price-up/20'
                                    : 'bg-price-down/10 text-price-down border-price-down/20'
                                }
                              >
                                {signal.result}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">Pending</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-price-up">
                            {signal.max_favorable ? `+${signal.max_favorable}` : '--'}
                          </TableCell>
                          <TableCell className="font-mono text-price-down">
                            {signal.max_adverse ? signal.max_adverse : '--'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No signals found. Add your first signal using the form.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Signal</CardTitle>
              <CardDescription>Record a new trading signal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Signal Type</Label>
                <Select value={signalType} onValueChange={setSignalType}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakout">Breakout</SelectItem>
                    <SelectItem value="reversal">Reversal</SelectItem>
                    <SelectItem value="momentum">Momentum</SelectItem>
                    <SelectItem value="mean_reversion">Mean Reversion</SelectItem>
                    <SelectItem value="volatility">Volatility</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Entry Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="22000.50"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="bg-background text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label>Strategy Tag (optional)</Label>
                <Input
                  type="text"
                  placeholder="PCR reversal"
                  value={strategyTag}
                  onChange={(e) => setStrategyTag(e.target.value)}
                  className="bg-background text-foreground"
                />
              </div>

              <Button onClick={handleSaveSignal} className="w-full">
                <Target className="h-4 w-4 mr-2" />
                Save Signal
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default SignalsPage;