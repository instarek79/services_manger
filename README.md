# Server Monitor — Infrastructure Monitoring System

A client-server application for monitoring multiple servers from a centralized dashboard. The **Agent** (Python, no GUI) runs on each monitored server and periodically collects system metrics, sending them to the **Dashboard** (Next.js) for visualization, alerting, and management.

---

## Architecture

```
┌─────────────────┐     HTTPS/REST API      ┌──────────────────────┐
│  Agent (Python)  │ ──────────────────────► │  Dashboard (Next.js) │
│  Server A        │   POST /api/metrics     │  Centralized Server  │
└─────────────────┘   POST /api/ping         │                      │
┌─────────────────┐                          │  - Web UI            │
│  Agent (Python)  │ ──────────────────────► │  - SQLite DB         │
│  Server B        │                         │  - REST API          │
└─────────────────┘                          │  - Alerts & Notifs   │
┌─────────────────┐                          │  - Rate Limiting     │
│  Agent (Python)  │ ──────────────────────► │  - Data Export       │
│  Server C        │                         └──────────────────────┘
└─────────────────┘
```

---

## Features

### Client Agent (Python)
- **System Metrics**: CPU %, memory (total/used/free/%), disk partitions, network I/O
- **Server Identity**: hostname, IP address, OS info, uptime, boot time
- **Process Monitoring**: top N processes by CPU and memory (configurable)
- **Service Monitoring**: configurable list of Windows/Linux services
- **Auto-Discover Services**: automatically discovers all system services when no explicit list is configured
- **Near-Live Performance Mode**: optional high-frequency collection (5–60s interval) in a background thread
  - CPU overall + per-core, CPU frequency
  - Memory + swap usage
  - Network send/recv rates (bytes/sec, packets/sec)
  - Disk I/O read/write rates (bytes/sec, IOPS)
  - Process count, thread count, handle count
- **Configurable Interval**: 5/10/15/20/30/60 minutes via config file
- **API Key Authentication**: secure Bearer token communication
- **Retry & Offline Buffering**: queues data when dashboard is unreachable (up to 100 payloads)
- **Auto-Registration**: registers itself on first run, saves credentials
- **Heartbeat Ping**: mid-cycle ping to keep server marked as online
- **Config Hot-Reload**: picks up config.json changes every cycle without restart
- **Graceful Shutdown**: handles SIGINT/SIGTERM cleanly, reports cycle count
- **Custom Config Path**: pass alternate config file as CLI argument (`python agent.py myconfig.json`)
- **Logging**: rotating log files with configurable size/count
- **Service Installation**: install as Windows Scheduled Task or Linux systemd service

### Dashboard Server (Next.js)
- **Summary Cards**: total/online/offline servers, active/critical alerts, unread notifications
- **Environment Overview**: grouped topology map showing all servers at a glance with CPU bars
- **Server Grid View**: visual cards per server with CPU/memory gauges, disk bars, status dots
- **Server List View**: compact table view with status, CPU, memory, alert count
- **Server Comparison**: bar chart comparing CPU and memory usage across all servers
- **Server Detail Page**: deep-dive with gauges, disk usage, performance charts, processes, services
- **Performance Monitor**: near-live dashboard tab with real-time CPU, memory, swap, network rate, disk I/O charts
  - Per-core CPU bar chart
  - Configurable time window (1m/2m/5m/10m/15m/30m)
  - Configurable refresh rate (2s/5s/10s) with pause/resume
  - Live stat cards with color-coded thresholds
- **Performance Benchmark**: min/max/avg statistics over configurable periods (5m/15m/30m/60m)
  - CPU, memory, swap, process count, thread count
  - Visual range bars showing min–avg–max spread
- **Performance Charts**: CPU and memory area charts over 6h/12h/24h/48h/72h (Recharts)
- **Process Explorer**: top processes table with PID, CPU/memory %, status, username
- **Service Status Panel**: monitored services with running/stopped/error indicators
- **Alert System**: threshold-based alerts (CPU/memory/disk) with warning and critical severity
- **Notification Bell**: in-app notification center with mark-read and mark-all-read
- **Server Management**: edit display name, group, notes, thresholds; delete servers
- **Server Grouping**: organize servers into named groups with color-coded topology
- **Search & Filter**: search by hostname/display name/IP, filter by group and status
- **Grid/List/Map Toggle**: switch between card, table, and environment overview
- **Global Settings Page**: configure stale threshold, data retention, email alerts, SMTP
- **Data Export**: export all server data as JSON or CSV reports
- **Data Cleanup**: purge old metrics/alerts beyond retention period
- **Auto-Refresh**: 30-second polling with on/off toggle
- **Dark/Light Mode**: theme toggle with custom scrollbar styling
- **Loading Skeleton**: animated skeleton UI while data loads
- **Responsive Design**: works on desktop and tablet
- **SQLite Database**: zero-config, file-based storage with WAL mode and indexed queries

### Security
- **API Key Authentication**: unique `smk_` prefixed key per server, bcrypt-hashed in DB
- **Bearer Token Auth**: `server_id:api_key` format in Authorization header
- **Rate Limiting**: 120 requests/minute per IP on metrics and registration endpoints
- **Input Validation**: all API inputs validated and sanitized
- **SSL/TLS Support**: configurable HTTPS verification in agent
- **No Hardcoded Secrets**: keys stored in config files, never in code

---

## Quick Start

### 1. Start the Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Dashboard runs at **http://localhost:3000**

### 2. Populate with Demo Data (optional)

```bash
cd agent
pip install -r requirements.txt
python demo_simulate.py --url http://localhost:3000 --count 8 --rounds 12

# With live performance data:
python demo_simulate.py --url http://localhost:3000 --count 8 --rounds 12 --live --live-ticks 30
```

This registers 8 simulated servers across 5 groups and sends 12 rounds of realistic metrics.
With `--live`, it also sends 30 ticks of near-live performance data per server.

### 3. Install & Run the Agent

On each server you want to monitor:

```bash
cd agent
pip install -r requirements.txt

# Edit config.json to set dashboard_url
# (server_id and api_key will be auto-generated on first run)

python agent.py
```

The agent will:
1. Auto-register with the dashboard
2. Save its `server_id` and `api_key` to `config.json`
3. Start collecting and sending metrics at the configured interval
4. Send heartbeat pings between collection cycles
5. Hot-reload config changes every cycle

### 4. Install Agent as a Service (optional)

**Windows** (run as Administrator):
```bash
python install_service.py
```

**Linux** (run as root):
```bash
sudo python3 install_service.py
```

**Uninstall:**
```bash
python install_service.py uninstall
```

---

## Configuration

### Agent (`agent/config.json`)

| Key | Default | Description |
|-----|---------|-------------|
| `dashboard_url` | `http://localhost:3000` | Dashboard server URL |
| `server_id` | `""` | Auto-filled on registration |
| `api_key` | `""` | Auto-filled on registration |
| `collection_interval_minutes` | `10` | Collection frequency (5-60) |
| `top_processes_count` | `15` | Number of top processes to report |
| `monitored_services` | `[]` | List of service names to monitor |
| `auto_discover_services` | `true` | Auto-discover all services when list is empty |
| `live_enabled` | `false` | Enable near-live performance collection |
| `live_interval_seconds` | `10` | Live collection frequency (5-60 seconds) |
| `live_retention_minutes` | `30` | How long to keep live data on dashboard |
| `log_file` | `agent.log` | Log file name |
| `retry_attempts` | `3` | API retry count |
| `retry_delay_seconds` | `10` | Delay between retries |
| `verify_ssl` | `true` | Verify SSL certificates |
| `offline_buffer_max` | `100` | Max buffered payloads when offline |

### Monitored Services Example

**Windows:**
```json
{
  "monitored_services": ["wuauserv", "Spooler", "W3SVC", "MSSQLSERVER", "W32Time"]
}
```

**Linux:**
```json
{
  "monitored_services": ["nginx", "postgresql", "docker", "sshd", "redis-server"]
}
```

### Dashboard Settings (via Settings page)
- **Dashboard refresh interval** (seconds)
- **Stale threshold** — minutes before a server is marked offline
- **Data retention** — days to keep historical data
- **Email alerts** — SMTP host, port, recipients (optional)
- **Per-server thresholds** — CPU/memory/disk alert percentages
- **Server display name, group, and notes**

---

## API Reference

### `POST /api/register`
Register a new server agent. Rate limited.

**Request:**
```json
{
  "hostname": "web-server-01",
  "ip_address": "192.168.1.10",
  "os_info": "Windows Server 2022 AMD64"
}
```

**Response (201):**
```json
{
  "server_id": "uuid",
  "api_key": "smk_...",
  "message": "Server registered successfully."
}
```

### `POST /api/metrics`
Submit metrics. Requires Bearer auth. Rate limited.

**Headers:** `Authorization: Bearer {server_id}:{api_key}`

**Request:**
```json
{
  "metrics": {
    "cpu_percent": 45.2,
    "memory_total": 17179869184,
    "memory_used": 8589934592,
    "memory_free": 8589934592,
    "memory_percent": 50.0,
    "disks": [{"device": "C:\\", "mountpoint": "C:\\", "total": 500000000000, "used": 250000000000, "free": 250000000000, "percent": 50.0}],
    "network": {"bytes_sent": 1000000, "bytes_recv": 2000000, "packets_sent": 5000, "packets_recv": 8000},
    "uptime_seconds": 86400,
    "boot_time": "2025-01-01T00:00:00"
  },
  "processes": [{"pid": 1234, "name": "node.exe", "cpu_percent": 12.5, "memory_percent": 3.2, "memory_mb": 512.0, "status": "running", "username": "SYSTEM"}],
  "services": [{"service_name": "W3SVC", "display_name": "World Wide Web Publishing", "status": "running", "start_type": "automatic", "pid": 4567}]
}
```

### `POST /api/metrics/live`
Submit near-live performance snapshot. Requires Bearer auth. Rate limited.

**Request:**
```json
{
  "cpu_percent": 45.2,
  "cpu_per_core": [32.1, 55.0, 40.3, 52.8],
  "cpu_freq_mhz": 3200,
  "memory_percent": 62.5,
  "memory_used": 10737418240,
  "memory_available": 6442450944,
  "swap_percent": 12.3,
  "swap_used": 1073741824,
  "network_rate": {"bytes_sent_per_sec": 125000, "bytes_recv_per_sec": 250000, "packets_sent_per_sec": 150, "packets_recv_per_sec": 300},
  "disk_io_rate": {"read_bytes_per_sec": 5000000, "write_bytes_per_sec": 3000000, "read_count_per_sec": 100, "write_count_per_sec": 80},
  "process_count": 245,
  "thread_count": 1850,
  "handle_count": 45000
}
```

### `POST /api/ping`
Lightweight heartbeat. Requires Bearer auth. Updates last-seen timestamp.

### `GET /api/ping`
Health check. No auth required. Returns service status.

### `GET /api/dashboard`
Full dashboard data (summary + all servers with latest metrics + recent alerts).

### `GET /api/dashboard/server/{id}?hours=24`
Detailed server data with metric history, processes, services, and alerts.

### `GET /api/dashboard/server/{id}/live?minutes=5&benchmark=30`
Live performance metrics and benchmark statistics. Returns recent high-frequency snapshots and min/max/avg aggregates.

### `PATCH /api/dashboard/server/{id}`
Update server settings (display_name, group_name, notes, thresholds, interval).

### `DELETE /api/dashboard/server/{id}`
Remove a server and all its data.

### `GET /api/dashboard/alerts`
Get all active (unacknowledged) alerts.

### `PATCH /api/dashboard/alerts`
Acknowledge an alert: `{"alert_id": 123}`

### `GET /api/dashboard/notifications`
Get unread notifications (max 50).

### `PATCH /api/dashboard/notifications`
Mark read: `{"notification_id": 123}` or `{"mark_all": true}`

### `GET /api/dashboard/settings`
Get global dashboard settings.

### `PATCH /api/dashboard/settings`
Update global settings.

### `DELETE /api/dashboard/settings`
Run data cleanup (purge data beyond retention period).

### `GET /api/dashboard/export?format=json&hours=168`
Export all server data. Formats: `json`, `csv`. CSV triggers file download.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Dashboard Frontend | Next.js 16, React 19, Tailwind CSS, Recharts, Lucide Icons |
| Dashboard Backend | Next.js API Routes (Node.js) |
| Database | SQLite (better-sqlite3) with WAL mode |
| Client Agent | Python 3.8+, psutil, requests |
| Authentication | API keys with bcrypt hashing |
| Rate Limiting | In-memory sliding window (120 req/min/IP) |

---

## Project Structure

```
services_manger/
├── README.md
├── dashboard/                    # Next.js dashboard server
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Main entry point
│   │   │   ├── layout.tsx        # Root layout
│   │   │   ├── globals.css       # Global styles
│   │   │   └── api/              # REST API routes
│   │   │       ├── register/     # Agent registration
│   │   │       ├── metrics/      # Metrics ingestion
│   │   │       │   └── live/     # Live performance ingestion
│   │   │       ├── ping/         # Heartbeat + health check
│   │   │       └── dashboard/    # Dashboard data APIs
│   │   ├── components/           # React components
│   │   │   ├── Dashboard.tsx     # Main dashboard page
│   │   │   ├── ServerCard.tsx    # Server card (grid view)
│   │   │   ├── ServerDetail.tsx  # Server detail page
│   │   │   ├── PerformanceMonitor.tsx  # Live performance & benchmark
│   │   │   ├── SummaryCards.tsx  # Summary statistics
│   │   │   ├── AlertPanel.tsx    # Alert list
│   │   │   ├── NotificationBell.tsx
│   │   │   ├── EnvironmentOverview.tsx
│   │   │   ├── GlobalSettings.tsx
│   │   │   ├── CircularGauge.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   └── LoadingSkeleton.tsx
│   │   └── lib/                  # Shared utilities
│   │       ├── database.ts       # SQLite operations
│   │       ├── auth.ts           # API key validation
│   │       ├── rate-limit.ts     # Rate limiting
│   │       ├── types.ts          # TypeScript interfaces
│   │       └── utils.ts          # Formatting helpers
│   ├── data/                     # SQLite database (gitignored)
│   └── package.json
└── agent/                        # Python monitoring agent
    ├── agent.py                  # Main agent script
    ├── install_service.py        # Service installer
    ├── demo_simulate.py          # Demo data generator
    ├── config.json               # Agent configuration
    └── requirements.txt          # Python dependencies
```

---

## Production Deployment

1. **Dashboard**: Build with `npm run build` and run with `npm start` (or deploy to any Node.js host)
2. **HTTPS**: Use a reverse proxy (nginx/caddy) with SSL certificates
3. **Agent**: Set `verify_ssl: true` and use HTTPS dashboard URL
4. **Firewall**: Only expose the dashboard port (3000) to agent IPs
5. **Backup**: Periodically backup `dashboard/data/monitoring.db`
6. **Cleanup**: Use the Global Settings page or `DELETE /api/dashboard/settings` to purge old data

---

## License

MIT
devops-dashboard.aws.originsysglobal.com
