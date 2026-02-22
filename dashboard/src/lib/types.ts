export interface ServerInfo {
  id: string;
  hostname: string;
  ip_address: string;
  os_info: string;
  group_name: string;
  display_name: string;
  notes: string;
  alert_cpu_threshold: number;
  alert_memory_threshold: number;
  alert_disk_threshold: number;
  collection_interval: number;
  is_active: number;
  registered_at: string;
  last_seen_at: string | null;
  status: 'online' | 'warning' | 'critical' | 'offline';
  metrics: MetricsData | null;
  alert_count: number;
  critical_count: number;
}

export interface MetricsData {
  cpu_percent: number;
  memory_total: number;
  memory_used: number;
  memory_free: number;
  memory_percent: number;
  disks: DiskInfo[];
  network: NetworkInfo;
  uptime_seconds: number;
  boot_time: string;
  timestamp: string;
}

export interface DiskInfo {
  device: string;
  mountpoint: string;
  total: number;
  used: number;
  free: number;
  percent: number;
}

export interface NetworkInfo {
  bytes_sent: number;
  bytes_recv: number;
  packets_sent: number;
  packets_recv: number;
}

export interface ProcessInfo {
  id: number;
  server_id: string;
  timestamp: string;
  pid: number;
  name: string;
  cpu_percent: number;
  memory_percent: number;
  memory_mb: number;
  status: string;
  username: string;
}

export interface ServiceInfo {
  id: number;
  server_id: string;
  timestamp: string;
  service_name: string;
  display_name: string;
  status: string;
  start_type: string;
  pid: number;
}

export interface AlertInfo {
  id: number;
  server_id: string;
  timestamp: string;
  alert_type: string;
  severity: 'warning' | 'critical';
  message: string;
  metric_value: number;
  threshold_value: number;
  is_acknowledged: number;
  hostname: string;
  display_name: string;
}

export interface NotificationInfo {
  id: number;
  alert_id: number;
  timestamp: string;
  channel: string;
  message: string;
  is_read: number;
  server_id?: string;
  severity?: 'warning' | 'critical';
  alert_type?: string;
  metric_value?: number;
  threshold_value?: number;
  hostname?: string;
  display_name?: string;
  ip_address?: string;
}

export interface DashboardSummary {
  totalServers: number;
  onlineServers: number;
  offlineServers: number;
  activeAlerts: number;
  criticalAlerts: number;
  unreadNotifications: number;
  groups: string[];
}

export interface DashboardData {
  summary: DashboardSummary;
  servers: ServerInfo[];
  alerts: AlertInfo[];
}

export interface MetricsHistory {
  timestamp: string;
  cpu_percent: number;
  memory_percent: number;
  memory_used: number;
  memory_free: number;
}

export interface ServerDetailData {
  server: ServerInfo;
  metrics: MetricsData | null;
  history: MetricsHistory[];
  processes: ProcessInfo[];
  services: ServiceInfo[];
  alerts: AlertInfo[];
}

export interface LiveMetricsSnapshot {
  timestamp: string;
  cpu_percent: number;
  cpu_per_core: number[];
  cpu_freq_mhz: number;
  memory_percent: number;
  memory_used: number;
  memory_available: number;
  swap_percent: number;
  swap_used: number;
  network_rate: {
    bytes_sent_per_sec: number;
    bytes_recv_per_sec: number;
    packets_sent_per_sec: number;
    packets_recv_per_sec: number;
  };
  disk_io_rate: {
    read_bytes_per_sec: number;
    write_bytes_per_sec: number;
    read_count_per_sec: number;
    write_count_per_sec: number;
  };
  process_count: number;
  thread_count: number;
  handle_count: number;
}

export interface LiveBenchmark {
  sample_count: number;
  cpu_min: number;
  cpu_max: number;
  cpu_avg: number;
  mem_min: number;
  mem_max: number;
  mem_avg: number;
  swap_min: number;
  swap_max: number;
  swap_avg: number;
  proc_min: number;
  proc_max: number;
  proc_avg: number;
  thread_min: number;
  thread_max: number;
  thread_avg: number;
}

export interface LiveMetricsData {
  metrics: LiveMetricsSnapshot[];
  benchmark: LiveBenchmark | null;
  server_id: string;
  minutes: number;
  benchmark_minutes: number;
}
