import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcryptjs from 'bcryptjs';

const DB_PATH = path.join(process.cwd(), 'data', 'monitoring.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      hostname TEXT NOT NULL,
      ip_address TEXT,
      os_info TEXT,
      api_key_hash TEXT NOT NULL,
      group_name TEXT DEFAULT 'Default',
      display_name TEXT,
      notes TEXT,
      alert_cpu_threshold REAL DEFAULT 90,
      alert_memory_threshold REAL DEFAULT 90,
      alert_disk_threshold REAL DEFAULT 90,
      collection_interval INTEGER DEFAULT 10,
      is_active INTEGER DEFAULT 1,
      registered_at TEXT DEFAULT (datetime('now')),
      last_seen_at TEXT
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      cpu_percent REAL,
      memory_total INTEGER,
      memory_used INTEGER,
      memory_free INTEGER,
      memory_percent REAL,
      disk_info TEXT,
      network_info TEXT,
      uptime_seconds INTEGER,
      boot_time TEXT,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS processes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      pid INTEGER,
      name TEXT,
      cpu_percent REAL,
      memory_percent REAL,
      memory_mb REAL,
      status TEXT,
      username TEXT,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      service_name TEXT NOT NULL,
      display_name TEXT,
      status TEXT,
      start_type TEXT,
      pid INTEGER,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning',
      message TEXT NOT NULL,
      metric_value REAL,
      threshold_value REAL,
      is_acknowledged INTEGER DEFAULT 0,
      acknowledged_at TEXT,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id INTEGER,
      timestamp TEXT DEFAULT (datetime('now')),
      channel TEXT DEFAULT 'in_app',
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS live_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      cpu_percent REAL,
      cpu_per_core TEXT,
      cpu_freq_mhz REAL,
      memory_percent REAL,
      memory_used INTEGER,
      memory_available INTEGER,
      swap_percent REAL,
      swap_used INTEGER,
      network_rate TEXT,
      disk_io_rate TEXT,
      process_count INTEGER,
      thread_count INTEGER,
      handle_count INTEGER,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_pending_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL,
      config_key TEXT NOT NULL,
      config_value TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      applied_at TEXT,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_agent_pending_config_server ON agent_pending_config(server_id, applied_at);
    CREATE INDEX IF NOT EXISTS idx_live_metrics_server_time ON live_metrics(server_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_metrics_server_time ON metrics(server_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_processes_server_time ON processes(server_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_services_server_time ON services(server_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_alerts_server ON alerts(server_id, is_acknowledged);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
  `);

  // Insert default settings if not exist
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  insertSetting.run('alert_email_enabled', 'false');
  insertSetting.run('alert_email_to', '');
  insertSetting.run('alert_email_smtp_host', '');
  insertSetting.run('alert_email_smtp_port', '587');
  insertSetting.run('stale_threshold_minutes', '60');
  insertSetting.run('data_retention_days', '30');
  insertSetting.run('dashboard_refresh_seconds', '30');
}

// Server operations
export function registerServer(hostname: string, ipAddress: string, osInfo: string): { id: string; apiKey: string } {
  const db = getDb();
  const id = uuidv4();
  const apiKey = `smk_${uuidv4().replace(/-/g, '')}`;
  const apiKeyHash = bcryptjs.hashSync(apiKey, 10);

  db.prepare(
    'INSERT INTO servers (id, hostname, ip_address, os_info, api_key_hash, display_name) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, hostname, ipAddress, osInfo, apiKeyHash, hostname);

  return { id, apiKey };
}

export function validateApiKey(serverId: string, apiKey: string): boolean {
  const db = getDb();
  const server = db.prepare('SELECT api_key_hash FROM servers WHERE id = ? AND is_active = 1').get(serverId) as { api_key_hash: string } | undefined;
  if (!server) return false;
  return bcryptjs.compareSync(apiKey, server.api_key_hash);
}

export function updateLastSeen(serverId: string) {
  const db = getDb();
  db.prepare("UPDATE servers SET last_seen_at = datetime('now') WHERE id = ?").run(serverId);
}

export function getAllServers() {
  const db = getDb();
  return db.prepare('SELECT * FROM servers WHERE is_active = 1 ORDER BY group_name, display_name').all();
}

export function getServer(serverId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
}

export function updateServer(serverId: string, updates: Record<string, unknown>) {
  const db = getDb();
  const allowedFields = ['display_name', 'group_name', 'notes', 'alert_cpu_threshold', 'alert_memory_threshold', 'alert_disk_threshold', 'collection_interval', 'is_active'];
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (fields.length === 0) return;
  values.push(serverId);
  db.prepare(`UPDATE servers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteServer(serverId: string) {
  const db = getDb();
  db.prepare('DELETE FROM servers WHERE id = ?').run(serverId);
}

// Metrics operations
export function insertMetrics(serverId: string, data: {
  cpu_percent: number;
  memory_total: number;
  memory_used: number;
  memory_free: number;
  memory_percent: number;
  disk_info: string;
  network_info: string;
  uptime_seconds: number;
  boot_time: string;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO metrics (server_id, cpu_percent, memory_total, memory_used, memory_free, memory_percent, disk_info, network_info, uptime_seconds, boot_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(serverId, data.cpu_percent, data.memory_total, data.memory_used, data.memory_free, data.memory_percent, data.disk_info, data.network_info, data.uptime_seconds, data.boot_time);
}

export function getLatestMetrics(serverId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM metrics WHERE server_id = ? ORDER BY timestamp DESC LIMIT 1').get(serverId);
}

export function getMetricsHistory(serverId: string, hours: number = 24) {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM metrics WHERE server_id = ? AND timestamp >= datetime('now', '-${hours} hours') ORDER BY timestamp ASC`
  ).all(serverId);
}

// Process operations
export function insertProcesses(serverId: string, processes: Array<{
  pid: number;
  name: string;
  cpu_percent: number;
  memory_percent: number;
  memory_mb: number;
  status: string;
  username: string;
}>) {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO processes (server_id, pid, name, cpu_percent, memory_percent, memory_mb, status, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertMany = db.transaction((procs: typeof processes) => {
    for (const p of procs) {
      stmt.run(serverId, p.pid, p.name, p.cpu_percent, p.memory_percent, p.memory_mb, p.status, p.username);
    }
  });
  insertMany(processes);
}

export function getLatestProcesses(serverId: string, limit: number = 10) {
  const db = getDb();
  const latestTimestamp = db.prepare(
    'SELECT timestamp FROM processes WHERE server_id = ? ORDER BY timestamp DESC LIMIT 1'
  ).get(serverId) as { timestamp: string } | undefined;
  if (!latestTimestamp) return [];
  return db.prepare(
    'SELECT * FROM processes WHERE server_id = ? AND timestamp = ? ORDER BY cpu_percent DESC LIMIT ?'
  ).all(serverId, latestTimestamp.timestamp, limit);
}

// Service operations
export function insertServices(serverId: string, services: Array<{
  service_name: string;
  display_name: string;
  status: string;
  start_type: string;
  pid: number;
}>) {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO services (server_id, service_name, display_name, status, start_type, pid) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertMany = db.transaction((svcs: typeof services) => {
    for (const s of svcs) {
      stmt.run(serverId, s.service_name, s.display_name, s.status, s.start_type, s.pid);
    }
  });
  insertMany(services);
}

export function getLatestServices(serverId: string) {
  const db = getDb();
  const latestTimestamp = db.prepare(
    'SELECT timestamp FROM services WHERE server_id = ? ORDER BY timestamp DESC LIMIT 1'
  ).get(serverId) as { timestamp: string } | undefined;
  if (!latestTimestamp) return [];
  return db.prepare(
    'SELECT * FROM services WHERE server_id = ? AND timestamp = ? ORDER BY service_name'
  ).all(serverId, latestTimestamp.timestamp);
}

// Alert operations
export function createAlert(serverId: string, alertType: string, severity: string, message: string, metricValue: number, thresholdValue: number) {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO alerts (server_id, alert_type, severity, message, metric_value, threshold_value) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(serverId, alertType, severity, message, metricValue, thresholdValue);

  // Create in-app notification
  db.prepare(
    'INSERT INTO notifications (alert_id, message) VALUES (?, ?)'
  ).run(result.lastInsertRowid, message);

  return result.lastInsertRowid;
}

export function getActiveAlerts(serverId?: string) {
  const db = getDb();
  if (serverId) {
    return db.prepare(
      'SELECT a.*, s.hostname, s.display_name FROM alerts a JOIN servers s ON a.server_id = s.id WHERE a.server_id = ? AND a.is_acknowledged = 0 ORDER BY a.timestamp DESC'
    ).all(serverId);
  }
  return db.prepare(
    'SELECT a.*, s.hostname, s.display_name FROM alerts a JOIN servers s ON a.server_id = s.id WHERE a.is_acknowledged = 0 ORDER BY a.timestamp DESC'
  ).all();
}

export function acknowledgeAlert(alertId: number) {
  const db = getDb();
  db.prepare("UPDATE alerts SET is_acknowledged = 1, acknowledged_at = datetime('now') WHERE id = ?").run(alertId);
}

export function getUnreadNotifications() {
  const db = getDb();
  return db.prepare(
    `SELECT n.*, a.server_id, a.severity, a.alert_type, a.metric_value, a.threshold_value,
            s.hostname, s.display_name, s.ip_address
     FROM notifications n
     LEFT JOIN alerts a ON n.alert_id = a.id
     LEFT JOIN servers s ON a.server_id = s.id
     WHERE n.is_read = 0
     ORDER BY n.timestamp DESC LIMIT 50`
  ).all();
}

export function markNotificationRead(notificationId: number) {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notificationId);
}

export function markAllNotificationsRead() {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
}

// Check thresholds and create alerts
export function checkThresholds(serverId: string, cpuPercent: number, memoryPercent: number, diskInfo: string) {
  const db = getDb();
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as Record<string, unknown> | undefined;
  if (!server) return;

  const cpuThreshold = server.alert_cpu_threshold as number;
  const memThreshold = server.alert_memory_threshold as number;
  const diskThreshold = server.alert_disk_threshold as number;

  if (cpuPercent >= cpuThreshold) {
    const severity = cpuPercent >= 95 ? 'critical' : 'warning';
    createAlert(serverId, 'cpu', severity, `CPU usage at ${cpuPercent.toFixed(1)}% (threshold: ${cpuThreshold}%)`, cpuPercent, cpuThreshold);
  }

  if (memoryPercent >= memThreshold) {
    const severity = memoryPercent >= 95 ? 'critical' : 'warning';
    createAlert(serverId, 'memory', severity, `Memory usage at ${memoryPercent.toFixed(1)}% (threshold: ${memThreshold}%)`, memoryPercent, memThreshold);
  }

  try {
    const disks = JSON.parse(diskInfo);
    // Virtual/read-only filesystem types and mount prefixes to skip
    const virtualFsTypes = new Set(['squashfs', 'tmpfs', 'devtmpfs', 'overlay', 'aufs', 'iso9660', 'ramfs']);
    const skipMountPrefixes = ['/snap/', '/sys/', '/proc/', '/run/', '/dev/'];
    const skipDevicePrefixes = ['/dev/loop'];
    for (const disk of disks) {
      // Skip virtual/read-only mounts (snap, loop, tmpfs, etc.)
      if (disk.fstype && virtualFsTypes.has(disk.fstype.toLowerCase())) continue;
      if (disk.mountpoint && skipMountPrefixes.some((p: string) => disk.mountpoint.startsWith(p))) continue;
      if (disk.device && skipDevicePrefixes.some((p: string) => disk.device.startsWith(p))) continue;
      if (disk.percent >= diskThreshold) {
        const severity = disk.percent >= 95 ? 'critical' : 'warning';
        createAlert(serverId, 'disk', severity, `Disk ${disk.mountpoint} at ${disk.percent.toFixed(1)}% (threshold: ${diskThreshold}%)`, disk.percent, diskThreshold);
      }
    }
  } catch { /* ignore parse errors */ }
}

// Settings
export function getSetting(key: string): string | undefined {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

// Live metrics operations
export function insertLiveMetrics(serverId: string, data: {
  timestamp?: string;
  cpu_percent: number;
  cpu_per_core: string;
  cpu_freq_mhz: number;
  memory_percent: number;
  memory_used: number;
  memory_available: number;
  swap_percent: number;
  swap_used: number;
  network_rate: string;
  disk_io_rate: string;
  process_count: number;
  thread_count: number;
  handle_count: number;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO live_metrics (server_id, cpu_percent, cpu_per_core, cpu_freq_mhz, memory_percent, memory_used, memory_available, swap_percent, swap_used, network_rate, disk_io_rate, process_count, thread_count, handle_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(serverId, data.cpu_percent, data.cpu_per_core, data.cpu_freq_mhz, data.memory_percent, data.memory_used, data.memory_available, data.swap_percent, data.swap_used, data.network_rate, data.disk_io_rate, data.process_count, data.thread_count, data.handle_count);
}

export function getLiveMetrics(serverId: string, minutes: number = 5) {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM live_metrics WHERE server_id = ? AND timestamp >= datetime('now', '-${minutes} minutes') ORDER BY timestamp ASC`
  ).all(serverId);
}

export function getLiveBenchmark(serverId: string, minutes: number = 30) {
  const db = getDb();
  return db.prepare(
    `SELECT
       COUNT(*) as sample_count,
       MIN(cpu_percent) as cpu_min,
       MAX(cpu_percent) as cpu_max,
       AVG(cpu_percent) as cpu_avg,
       MIN(memory_percent) as mem_min,
       MAX(memory_percent) as mem_max,
       AVG(memory_percent) as mem_avg,
       MIN(swap_percent) as swap_min,
       MAX(swap_percent) as swap_max,
       AVG(swap_percent) as swap_avg,
       MIN(process_count) as proc_min,
       MAX(process_count) as proc_max,
       AVG(process_count) as proc_avg,
       MIN(thread_count) as thread_min,
       MAX(thread_count) as thread_max,
       AVG(thread_count) as thread_avg
     FROM live_metrics
     WHERE server_id = ? AND timestamp >= datetime('now', '-${minutes} minutes')`
  ).get(serverId);
}

export function cleanupLiveMetrics(retentionMinutes: number = 60) {
  const db = getDb();
  db.prepare(`DELETE FROM live_metrics WHERE timestamp < datetime('now', '-${retentionMinutes} minutes')`).run();
}

// Cleanup old data
export function cleanupOldData(retentionDays: number = 30) {
  const db = getDb();
  db.prepare(`DELETE FROM metrics WHERE timestamp < datetime('now', '-${retentionDays} days')`).run();
  db.prepare(`DELETE FROM processes WHERE timestamp < datetime('now', '-${retentionDays} days')`).run();
  db.prepare(`DELETE FROM services WHERE timestamp < datetime('now', '-${retentionDays} days')`).run();
  db.prepare(`DELETE FROM alerts WHERE timestamp < datetime('now', '-${retentionDays} days') AND is_acknowledged = 1`).run();
  db.prepare(`DELETE FROM notifications WHERE timestamp < datetime('now', '-${retentionDays} days') AND is_read = 1`).run();
  // Also cleanup old live metrics (keep max 60 minutes)
  cleanupLiveMetrics(60);
}

// Agent pending config operations
export function setPendingConfig(serverId: string, configs: Record<string, unknown>) {
  const db = getDb();
  // Clear any unapplied pending configs for the same keys
  const clearStmt = db.prepare(
    'DELETE FROM agent_pending_config WHERE server_id = ? AND config_key = ? AND applied_at IS NULL'
  );
  const insertStmt = db.prepare(
    'INSERT INTO agent_pending_config (server_id, config_key, config_value) VALUES (?, ?, ?)'
  );
  const upsert = db.transaction((cfgs: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(cfgs)) {
      clearStmt.run(serverId, key);
      insertStmt.run(serverId, key, JSON.stringify(value));
    }
  });
  upsert(configs);
}

export function getPendingConfig(serverId: string): Record<string, unknown> | null {
  const db = getDb();
  const rows = db.prepare(
    'SELECT config_key, config_value FROM agent_pending_config WHERE server_id = ? AND applied_at IS NULL ORDER BY created_at ASC'
  ).all(serverId) as { config_key: string; config_value: string }[];
  if (rows.length === 0) return null;
  const config: Record<string, unknown> = {};
  for (const row of rows) {
    try { config[row.config_key] = JSON.parse(row.config_value); } catch { config[row.config_key] = row.config_value; }
  }
  return config;
}

export function markConfigApplied(serverId: string) {
  const db = getDb();
  db.prepare(
    "UPDATE agent_pending_config SET applied_at = datetime('now') WHERE server_id = ? AND applied_at IS NULL"
  ).run(serverId);
}

export function getConfigHistory(serverId: string, limit: number = 50) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM agent_pending_config WHERE server_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(serverId, limit);
}

// Dashboard summary
export function getDashboardSummary() {
  const db = getDb();
  const totalServers = (db.prepare('SELECT COUNT(*) as count FROM servers WHERE is_active = 1').get() as { count: number }).count;
  const staleMinutes = parseInt(getSetting('stale_threshold_minutes') || '60');

  const onlineServers = (db.prepare(
    `SELECT COUNT(*) as count FROM servers WHERE is_active = 1 AND last_seen_at >= datetime('now', '-${staleMinutes} minutes')`
  ).get() as { count: number }).count;

  const activeAlerts = (db.prepare(
    'SELECT COUNT(*) as count FROM alerts WHERE is_acknowledged = 0'
  ).get() as { count: number }).count;

  const criticalAlerts = (db.prepare(
    "SELECT COUNT(*) as count FROM alerts WHERE is_acknowledged = 0 AND severity = 'critical'"
  ).get() as { count: number }).count;

  const unreadNotifications = (db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE is_read = 0'
  ).get() as { count: number }).count;

  const groups = db.prepare(
    'SELECT DISTINCT group_name FROM servers WHERE is_active = 1 ORDER BY group_name'
  ).all() as { group_name: string }[];

  return {
    totalServers,
    onlineServers,
    offlineServers: totalServers - onlineServers,
    activeAlerts,
    criticalAlerts,
    unreadNotifications,
    groups: groups.map(g => g.group_name),
  };
}
