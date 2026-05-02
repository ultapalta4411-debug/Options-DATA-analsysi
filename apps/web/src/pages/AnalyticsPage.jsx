import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import useTradingStore from '@/store/tradingStore';
import { getDaySummaries, saveDaySummary } from '@/db/indexedDB';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, Download, Target, Activity } from 'lucide-react';
import { toast } from 'sonner';

const AnalyticsPage = () => {
  const { currentSymbol, angelOneConnected } = useTradingStore();
  const [daySummaries, setDaySummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Manual entry form
  const [entryDate, setEntryDate] = useState('');
  const [dayType, setDayType] = useState('');
  const [gapPercent, setGapPercent] = useState('');
  const [signalsCount, setSignalsCount] = useState('');

  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      loadAnalytics();
    }
  }, [startDate, endDate, currentSymbol]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const summaries = await getDaySummaries(startDate, endDate);
      // Filter by current symbol if you add symbol tracking to summaries, else show all
      setDaySummaries(summaries);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDaySummary = async () => {
    if (!entryDate || !dayType) {
      toast.error('Please fill in date and day type');
      return;
    }

    try {
      await saveDaySummary({
        date: entryDate,
        day_type: dayType,
        gap_percent: parseFloat(gapPercent) || 0,
        signals_count: parseInt(signalsCount) || 0
      });
      toast.success('Day summary saved');
      setEntryDate('');
      setDayType('');
      setGapPercent('');
      setSignalsCount('');
      loadAnalytics();
    } catch (error) {
      toast.error('Failed to save day summary');
    }
  };

  const getDayTypeDistribution = () => {
    const distribution = {};
    daySummaries.forEach(day => {
      distribution[day.day_type] = (distribution[day.day_type] || 0) + 1;
    });
    
    return Object.entries(distribution).map(([type, count]) => ({
      name: type,
      value: count
    }));
  };

  const getGapBehavior = () => {
    return daySummaries.map(day => ({
      date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      gap: day.gap_percent,
      type: day.day_type
    }));
  };

  const dayTypeColors = {
    trending: 'hsl(var(--primary))',
    ranging: 'hsl(var(--muted-foreground))',
    volatile: 'hsl(var(--secondary))',
    reversal: 'hsl(var(--alert-high))'
  };

  return (
    <>
      <Helmet>
        <title>Analytics - Options Terminal</title>
        <meta name="description" content="Historical analysis and trading patterns" />
      </Helmet>

      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground" style={{ letterSpacing: '-0.02em' }}>
                Historical Analytics
              </h1>
              {angelOneConnected ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Live Connection</Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Offline Mode</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              Context and patterns for <span className="font-semibold text-foreground">{currentSymbol}</span>
            </p>
          </div>
          
          <div className="flex gap-2 bg-card p-1 rounded-lg border border-border">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-0 w-36 h-8 text-sm focus-visible:ring-0"
            />
            <span className="self-center text-muted-foreground text-sm">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-0 w-36 h-8 text-sm focus-visible:ring-0"
            />
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Day Type Distribution
              </CardTitle>
              <CardDescription>Classification of trading days in period</CardDescription>
            </CardHeader>
            <CardContent>
              {getDayTypeDistribution().length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={getDayTypeDistribution()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={110}
                      innerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {getDayTypeDistribution().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={dayTypeColors[entry.name] || 'hsl(var(--muted))'} stroke="hsl(var(--card))" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[320px] flex items-center justify-center text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border">
                  No summary data recorded for this period
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-secondary" />
                Gap Behavior Analysis
              </CardTitle>
              <CardDescription>Opening gap percentages and subsequent day types</CardDescription>
            </CardHeader>
            <CardContent>
              {getGapBehavior().length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={getGapBehavior()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} dy={10} />
                    <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                    />
                    <Bar dataKey="gap" radius={[4, 4, 0, 0]} maxBarSize={30}>
                      {getGapBehavior().map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.gap >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[320px] flex items-center justify-center text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border">
                  No gap data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Add Day Summary Form */}
        <Card className="bg-muted/30 border-dashed">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Record Day Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Classification</Label>
                <Select value={dayType} onValueChange={setDayType}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trending">Trending</SelectItem>
                    <SelectItem value="ranging">Ranging</SelectItem>
                    <SelectItem value="volatile">Volatile</SelectItem>
                    <SelectItem value="reversal">Reversal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Gap %</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="+0.45"
                  value={gapPercent}
                  onChange={(e) => setGapPercent(e.target.value)}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Signals Count</Label>
                <Input
                  type="number"
                  placeholder="3"
                  value={signalsCount}
                  onChange={(e) => setSignalsCount(e.target.value)}
                  className="bg-background"
                />
              </div>
              
              <Button onClick={handleSaveDaySummary} className="w-full">
                Save Daily Record
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default AnalyticsPage;