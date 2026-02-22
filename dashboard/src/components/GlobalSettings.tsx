'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Trash2,
  Download,
  ArrowLeft,
  Mail,
  Clock,
  Database,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';

interface GlobalSettingsProps {
  onBack: () => void;
}

export default function GlobalSettings({ onBack }: GlobalSettingsProps) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/dashboard/settings');
      const json = await res.json();
      setSettings(json.settings || {});
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm(`Delete data older than ${settings.data_retention_days || 30} days?`)) return;
    setCleaning(true);
    setMessage(null);
    try {
      const res = await fetch('/api/dashboard/settings', { method: 'DELETE' });
      const json = await res.json();
      setMessage({ type: 'success', text: json.message || 'Cleanup complete' });
    } catch {
      setMessage({ type: 'error', text: 'Cleanup failed' });
    } finally {
      setCleaning(false);
    }
  };

  const handleExport = (format: 'json' | 'csv') => {
    window.open(`/api/dashboard/export?format=${format}&hours=168`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Global Settings</h2>
          <p className="text-sm text-gray-500">Configure dashboard behavior, alerts, and data management</p>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
        }`}>
          <CheckCircle className="w-4 h-4" />
          {message.text}
        </div>
      )}

      {/* Dashboard Settings */}
      <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4 shadow-sm dark:shadow-none">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          Dashboard Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dashboard Refresh Interval (seconds)</label>
            <input
              type="number"
              min={10}
              max={300}
              value={settings.dashboard_refresh_seconds || '30'}
              onChange={(e) => setSettings({ ...settings, dashboard_refresh_seconds: e.target.value })}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Stale Threshold (minutes)</label>
            <input
              type="number"
              min={5}
              max={1440}
              value={settings.stale_threshold_minutes || '60'}
              onChange={(e) => setSettings({ ...settings, stale_threshold_minutes: e.target.value })}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
            <p className="text-[10px] text-gray-600 mt-1">Servers not reporting within this time are marked offline</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data Retention (days)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={settings.data_retention_days || '30'}
              onChange={(e) => setSettings({ ...settings, data_retention_days: e.target.value })}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Email Alert Settings */}
      <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4 shadow-sm dark:shadow-none">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Mail className="w-4 h-4 text-violet-400" />
          Email Alerts (Optional)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Enable Email Alerts</label>
            <select
              value={settings.alert_email_enabled || 'false'}
              onChange={(e) => setSettings({ ...settings, alert_email_enabled: e.target.value })}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            >
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Alert Email Recipients</label>
            <input
              type="text"
              placeholder="admin@example.com"
              value={settings.alert_email_to || ''}
              onChange={(e) => setSettings({ ...settings, alert_email_to: e.target.value })}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">SMTP Host</label>
            <input
              type="text"
              placeholder="smtp.example.com"
              value={settings.alert_email_smtp_host || ''}
              onChange={(e) => setSettings({ ...settings, alert_email_smtp_host: e.target.value })}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">SMTP Port</label>
            <input
              type="number"
              value={settings.alert_email_smtp_port || '587'}
              onChange={(e) => setSettings({ ...settings, alert_email_smtp_port: e.target.value })}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4 shadow-sm dark:shadow-none">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-amber-400" />
          Data Management
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleExport('json')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm border border-blue-500/30"
          >
            <Download className="w-4 h-4" />
            Export JSON Report
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-sm border border-emerald-500/30"
          >
            <Download className="w-4 h-4" />
            Export CSV Report
          </button>
          <button
            onClick={handleCleanup}
            disabled={cleaning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm border border-red-500/30 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {cleaning ? 'Cleaning...' : `Cleanup Old Data (>${settings.data_retention_days || 30}d)`}
          </button>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}
