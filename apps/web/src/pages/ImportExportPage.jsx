import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Download, Database, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import db from '@/db/indexedDB';

const ImportExportPage = () => {
  const [importData, setImportData] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExportAll = async () => {
    setLoading(true);
    try {
      const data = {
        option_chain_snapshots: await db.option_chain_snapshots.toArray(),
        pcr_history: await db.pcr_history.toArray(),
        iv_history: await db.iv_history.toArray(),
        greeks_history: await db.greeks_history.toArray(),
        day_summary: await db.day_summary.toArray(),
        signals: await db.signals.toArray(),
        premium_decay: await db.premium_decay.toArray(),
        settings: await db.settings.toArray(),
        exported_at: new Date().toISOString()
      };

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trading_terminal_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      toast('All data exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      toast.error('Please paste JSON data to import');
      return;
    }

    setLoading(true);
    try {
      const data = JSON.parse(importData);

      // Clear existing data
      await db.option_chain_snapshots.clear();
      await db.pcr_history.clear();
      await db.iv_history.clear();
      await db.greeks_history.clear();
      await db.day_summary.clear();
      await db.signals.clear();
      await db.premium_decay.clear();
      await db.settings.clear();

      // Import new data
      if (data.option_chain_snapshots) await db.option_chain_snapshots.bulkAdd(data.option_chain_snapshots);
      if (data.pcr_history) await db.pcr_history.bulkAdd(data.pcr_history);
      if (data.iv_history) await db.iv_history.bulkAdd(data.iv_history);
      if (data.greeks_history) await db.greeks_history.bulkAdd(data.greeks_history);
      if (data.day_summary) await db.day_summary.bulkAdd(data.day_summary);
      if (data.signals) await db.signals.bulkAdd(data.signals);
      if (data.premium_decay) await db.premium_decay.bulkAdd(data.premium_decay);
      if (data.settings) await db.settings.bulkAdd(data.settings);

      toast('Data imported successfully');
      setImportData('');
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import data. Please check the JSON format.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImportData(event.target?.result);
    };
    reader.readAsText(file);
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      await db.option_chain_snapshots.clear();
      await db.pcr_history.clear();
      await db.iv_history.clear();
      await db.greeks_history.clear();
      await db.day_summary.clear();
      await db.signals.clear();
      await db.premium_decay.clear();
      await db.settings.clear();

      toast('All data cleared');
    } catch (error) {
      console.error('Clear error:', error);
      toast.error('Failed to clear data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Import/Export - Options Terminal</title>
        <meta name="description" content="Backup and restore your trading data" />
      </Helmet>

      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground" style={{ letterSpacing: '-0.02em' }}>
            Import / Export
          </h1>
          <p className="text-muted-foreground mt-1">
            Backup and restore your trading data
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Export Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Export Data
              </CardTitle>
              <CardDescription>
                Download all your trading data as JSON
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Includes all tables:</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                  <li>• Option chain snapshots</li>
                  <li>• PCR history</li>
                  <li>• IV history</li>
                  <li>• Greeks history</li>
                  <li>• Day summaries</li>
                  <li>• Trading signals</li>
                  <li>• Premium decay data</li>
                  <li>• Settings</li>
                </ul>
              </div>

              <Button 
                onClick={handleExportAll} 
                className="w-full"
                disabled={loading}
              >
                <Download className="h-4 w-4 mr-2" />
                Export All Data
              </Button>
            </CardContent>
          </Card>

          {/* Import Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Import Data
              </CardTitle>
              <CardDescription>
                Restore data from a backup file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Upload JSON File</Label>
                <Input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="bg-background text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label>Or Paste JSON Data</Label>
                <Textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder='{"option_chain_snapshots": [...], "pcr_history": [...]}'
                  className="h-32 font-mono text-sm bg-background text-foreground"
                />
              </div>

              <Button 
                onClick={handleImport} 
                className="w-full"
                disabled={loading || !importData.trim()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Data
              </Button>

              <p className="text-xs text-muted-foreground">
                Warning: Importing will replace all existing data
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions - proceed with caution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleClearAll} 
              variant="destructive"
              disabled={loading}
            >
              <Database className="h-4 w-4 mr-2" />
              Clear All Data
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ImportExportPage;