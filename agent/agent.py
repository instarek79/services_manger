#!/usr/bin/env python3
"""
Server Monitor Agent
Collects system metrics and sends them to the centralized dashboard.
Runs as a background service/daemon with no GUI.
"""

import json
import logging
import os
import platform
import signal
import socket
import sys
import threading
import time
from collections import deque
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

import psutil
import requests

# Graceful shutdown flag
_shutdown_event = threading.Event()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CONFIG_PATH = Path(
    sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].endswith(".json")
    else str(Path(__file__).parent / "config.json")
)
DEFAULT_CONFIG = {
    "dashboard_url": "http://localhost:3000",
    "server_id": "",
    "api_key": "",

    "collection_interval_minutes": 10,
    "ping_enabled": True,

    "display_name": "",
    "group_name": "Default",
    "tags": [],

    "collect_processes": True,
    "top_processes_count": 15,
    "collect_disks": True,
    "collect_network": True,
    "monitored_services": [],
    "auto_discover_services": True,

    "live_enabled": False,
    "live_interval_seconds": 10,
    "live_retention_minutes": 30,

    "log_file": "agent.log",
    "log_level": "INFO",
    "log_max_bytes": 5_242_880,
    "log_backup_count": 3,

    "request_timeout_seconds": 30,
    "retry_attempts": 3,
    "retry_delay_seconds": 10,
    "verify_ssl": True,
    "offline_buffer_max": 100,
}


def load_config() -> dict:
    """Load configuration from config.json, creating defaults if missing."""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r") as f:
            cfg = json.load(f)
        # Merge with defaults for any missing keys
        for k, v in DEFAULT_CONFIG.items():
            cfg.setdefault(k, v)
        return cfg
    else:
        save_config(DEFAULT_CONFIG)
        return dict(DEFAULT_CONFIG)


def save_config(cfg: dict):
    """Persist configuration to disk."""
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def setup_logging(cfg: dict) -> logging.Logger:
    log_path = Path(__file__).parent / cfg["log_file"]
    logger = logging.getLogger("server_monitor_agent")
    level = getattr(logging, cfg.get("log_level", "INFO").upper(), logging.INFO)
    logger.setLevel(level)

    handler = RotatingFileHandler(
        log_path,
        maxBytes=cfg["log_max_bytes"],
        backupCount=cfg["log_backup_count"],
    )
    handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
    )
    logger.addHandler(handler)

    # Also log to stdout
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
    )
    logger.addHandler(console)

    return logger


# ---------------------------------------------------------------------------
# System Information Collectors
# ---------------------------------------------------------------------------

def get_system_info(cfg: dict) -> dict:
    """Collect static system information for registration."""
    info = {
        "hostname": socket.gethostname(),
        "ip_address": _get_primary_ip(),
        "os_info": f"{platform.system()} {platform.release()} {platform.machine()}",
    }
    # Include optional display name and group from config
    if cfg.get("display_name"):
        info["display_name"] = cfg["display_name"]
    if cfg.get("group_name"):
        info["group_name"] = cfg["group_name"]
    if cfg.get("tags"):
        info["tags"] = cfg["tags"]
    return info


def _get_primary_ip() -> str:
    """Get the primary IP address of this machine."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def collect_metrics(cfg: dict) -> dict:
    """Collect current system metrics based on config toggles."""
    cpu_percent = psutil.cpu_percent(interval=1)

    mem = psutil.virtual_memory()
    memory = {
        "memory_total": mem.total,
        "memory_used": mem.used,
        "memory_free": mem.available,
        "memory_percent": mem.percent,
    }

    disks = []
    if cfg.get("collect_disks", True):
        for part in psutil.disk_partitions(all=False):
            try:
                usage = psutil.disk_usage(part.mountpoint)
                disks.append({
                    "device": part.device,
                    "mountpoint": part.mountpoint,
                    "total": usage.total,
                    "used": usage.used,
                    "free": usage.free,
                    "percent": usage.percent,
                })
            except (PermissionError, OSError):
                continue

    network = None
    if cfg.get("collect_network", True):
        net = psutil.net_io_counters()
        network = {
            "bytes_sent": net.bytes_sent,
            "bytes_recv": net.bytes_recv,
            "packets_sent": net.packets_sent,
            "packets_recv": net.packets_recv,
        }

    boot_time = datetime.fromtimestamp(psutil.boot_time())
    uptime_seconds = int(time.time() - psutil.boot_time())

    return {
        "cpu_percent": cpu_percent,
        **memory,
        "disks": disks,
        "network": network,
        "uptime_seconds": uptime_seconds,
        "boot_time": boot_time.isoformat(),
    }


def collect_top_processes(count: int = 15) -> list:
    """Collect top processes by CPU and memory usage."""
    procs = []
    for proc in psutil.process_iter(
        ["pid", "name", "cpu_percent", "memory_percent", "memory_info", "status", "username"]
    ):
        try:
            info = proc.info
            procs.append({
                "pid": info["pid"],
                "name": info["name"] or "Unknown",
                "cpu_percent": info["cpu_percent"] or 0.0,
                "memory_percent": info["memory_percent"] or 0.0,
                "memory_mb": round((info["memory_info"].rss / 1024 / 1024) if info["memory_info"] else 0, 1),
                "status": info["status"] or "unknown",
                "username": info["username"] or "SYSTEM",
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    # Sort by CPU usage descending, take top N
    procs.sort(key=lambda p: p["cpu_percent"], reverse=True)
    return procs[:count]


def discover_services() -> list:
    """Auto-discover all services on the system."""
    services = []

    if platform.system() == "Windows":
        try:
            import subprocess
            result = subprocess.run(
                ["sc", "query", "type=", "service", "state=", "all"],
                capture_output=True, text=True, timeout=30
            )
            current_svc = None
            for line in result.stdout.splitlines():
                line = line.strip()
                if line.startswith("SERVICE_NAME:"):
                    current_svc = {
                        "service_name": line.split(":", 1)[1].strip(),
                        "display_name": "",
                        "status": "unknown",
                        "start_type": "unknown",
                        "pid": 0,
                    }
                elif current_svc and line.startswith("DISPLAY_NAME:"):
                    current_svc["display_name"] = line.split(":", 1)[1].strip()
                elif current_svc and line.startswith("STATE"):
                    state_str = line.upper()
                    if "RUNNING" in state_str:
                        current_svc["status"] = "running"
                    elif "STOPPED" in state_str:
                        current_svc["status"] = "stopped"
                    elif "PAUSED" in state_str:
                        current_svc["status"] = "paused"
                    elif "START_PENDING" in state_str:
                        current_svc["status"] = "starting"
                    elif "STOP_PENDING" in state_str:
                        current_svc["status"] = "stopping"
                elif current_svc and line.startswith("PID") and ":" in line:
                    try:
                        current_svc["pid"] = int(line.split(":")[1].strip())
                    except ValueError:
                        pass
                elif current_svc and line == "":
                    if current_svc["service_name"]:
                        if not current_svc["display_name"]:
                            current_svc["display_name"] = current_svc["service_name"]
                        services.append(current_svc)
                    current_svc = None
            # Don't forget the last service
            if current_svc and current_svc.get("service_name"):
                if not current_svc["display_name"]:
                    current_svc["display_name"] = current_svc["service_name"]
                services.append(current_svc)
        except Exception:
            pass
    else:
        # Linux: list all systemd units of type service
        try:
            import subprocess
            result = subprocess.run(
                ["systemctl", "list-units", "--type=service", "--all", "--no-pager", "--no-legend"],
                capture_output=True, text=True, timeout=30
            )
            for line in result.stdout.splitlines():
                parts = line.split()
                if len(parts) >= 4:
                    unit_name = parts[0].strip()
                    if unit_name.endswith(".service"):
                        unit_name = unit_name[:-8]  # strip .service
                    active = parts[2].strip() if len(parts) > 2 else "unknown"
                    sub = parts[3].strip() if len(parts) > 3 else "unknown"
                    status = "unknown"
                    if active == "active" and sub == "running":
                        status = "running"
                    elif active == "active" and sub == "exited":
                        status = "exited"
                    elif active == "inactive":
                        status = "stopped"
                    elif active == "failed":
                        status = "failed"
                    # Get description from remaining parts
                    desc = " ".join(parts[4:]) if len(parts) > 4 else unit_name
                    services.append({
                        "service_name": unit_name,
                        "display_name": desc,
                        "status": status,
                        "start_type": "unknown",
                        "pid": 0,
                    })
        except Exception:
            pass

    return services


def collect_services(service_names: list, auto_discover: bool = False) -> list:
    """Collect status of monitored services (Windows and Linux).
    If auto_discover is True and service_names is empty, discover all services."""
    if not service_names and auto_discover:
        return discover_services()
    if not service_names:
        return []

    services = []

    if platform.system() == "Windows":
        try:
            import subprocess
            for svc_name in service_names:
                try:
                    result = subprocess.run(
                        ["sc", "query", svc_name],
                        capture_output=True, text=True, timeout=10
                    )
                    output = result.stdout
                    status = "unknown"
                    if "RUNNING" in output:
                        status = "running"
                    elif "STOPPED" in output:
                        status = "stopped"
                    elif "PAUSED" in output:
                        status = "paused"

                    # Get display name and start type
                    result2 = subprocess.run(
                        ["sc", "qc", svc_name],
                        capture_output=True, text=True, timeout=10
                    )
                    display_name = svc_name
                    start_type = "unknown"
                    for line in result2.stdout.splitlines():
                        if "DISPLAY_NAME" in line:
                            display_name = line.split(":", 1)[1].strip()
                        if "START_TYPE" in line:
                            st = line.strip()
                            if "AUTO_START" in st:
                                start_type = "automatic"
                            elif "DEMAND_START" in st:
                                start_type = "manual"
                            elif "DISABLED" in st:
                                start_type = "disabled"

                    # Get PID
                    pid = 0
                    result3 = subprocess.run(
                        ["sc", "queryex", svc_name],
                        capture_output=True, text=True, timeout=10
                    )
                    for line in result3.stdout.splitlines():
                        if "PID" in line and ":" in line:
                            try:
                                pid = int(line.split(":")[1].strip())
                            except ValueError:
                                pass

                    services.append({
                        "service_name": svc_name,
                        "display_name": display_name,
                        "status": status,
                        "start_type": start_type,
                        "pid": pid,
                    })
                except Exception:
                    services.append({
                        "service_name": svc_name,
                        "display_name": svc_name,
                        "status": "error",
                        "start_type": "unknown",
                        "pid": 0,
                    })
        except ImportError:
            pass

    else:
        # Linux: use systemctl
        import subprocess
        for svc_name in service_names:
            try:
                result = subprocess.run(
                    ["systemctl", "is-active", svc_name],
                    capture_output=True, text=True, timeout=10
                )
                status = result.stdout.strip()
                if status == "active":
                    status = "running"
                elif status == "inactive":
                    status = "stopped"

                # Get more info
                result2 = subprocess.run(
                    ["systemctl", "show", svc_name, "--property=Description,UnitFileState,MainPID"],
                    capture_output=True, text=True, timeout=10
                )
                display_name = svc_name
                start_type = "unknown"
                pid = 0
                for line in result2.stdout.splitlines():
                    if line.startswith("Description="):
                        display_name = line.split("=", 1)[1]
                    elif line.startswith("UnitFileState="):
                        start_type = line.split("=", 1)[1]
                    elif line.startswith("MainPID="):
                        try:
                            pid = int(line.split("=", 1)[1])
                        except ValueError:
                            pass

                services.append({
                    "service_name": svc_name,
                    "display_name": display_name,
                    "status": status,
                    "start_type": start_type,
                    "pid": pid,
                })
            except Exception:
                services.append({
                    "service_name": svc_name,
                    "display_name": svc_name,
                    "status": "error",
                    "start_type": "unknown",
                    "pid": 0,
                })

    return services


# ---------------------------------------------------------------------------
# Live Performance Metrics Collector
# ---------------------------------------------------------------------------

# Track previous network counters for rate calculation
_prev_net_counters = None
_prev_net_time = None
# Track previous disk IO counters for rate calculation
_prev_disk_counters = None
_prev_disk_time = None


def collect_live_metrics() -> dict:
    """Collect lightweight, high-frequency performance snapshot.
    Includes CPU per-core, memory, network rate, disk I/O rate."""
    global _prev_net_counters, _prev_net_time
    global _prev_disk_counters, _prev_disk_time

    now = time.time()
    timestamp = datetime.utcnow().isoformat() + "Z"

    # CPU — overall and per-core (non-blocking, uses cached value)
    cpu_overall = psutil.cpu_percent(interval=0)
    cpu_per_core = psutil.cpu_percent(interval=0, percpu=True)
    cpu_freq = psutil.cpu_freq()

    # Memory
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()

    # Network rate
    net = psutil.net_io_counters()
    net_rate = {"bytes_sent_per_sec": 0, "bytes_recv_per_sec": 0,
                "packets_sent_per_sec": 0, "packets_recv_per_sec": 0}
    if _prev_net_counters and _prev_net_time:
        dt = now - _prev_net_time
        if dt > 0:
            net_rate["bytes_sent_per_sec"] = round((net.bytes_sent - _prev_net_counters.bytes_sent) / dt, 1)
            net_rate["bytes_recv_per_sec"] = round((net.bytes_recv - _prev_net_counters.bytes_recv) / dt, 1)
            net_rate["packets_sent_per_sec"] = round((net.packets_sent - _prev_net_counters.packets_sent) / dt, 1)
            net_rate["packets_recv_per_sec"] = round((net.packets_recv - _prev_net_counters.packets_recv) / dt, 1)
    _prev_net_counters = net
    _prev_net_time = now

    # Disk I/O rate
    try:
        disk_io = psutil.disk_io_counters()
        disk_rate = {"read_bytes_per_sec": 0, "write_bytes_per_sec": 0,
                     "read_count_per_sec": 0, "write_count_per_sec": 0}
        if disk_io and _prev_disk_counters and _prev_disk_time:
            dt = now - _prev_disk_time
            if dt > 0:
                disk_rate["read_bytes_per_sec"] = round((disk_io.read_bytes - _prev_disk_counters.read_bytes) / dt, 1)
                disk_rate["write_bytes_per_sec"] = round((disk_io.write_bytes - _prev_disk_counters.write_bytes) / dt, 1)
                disk_rate["read_count_per_sec"] = round((disk_io.read_count - _prev_disk_counters.read_count) / dt, 1)
                disk_rate["write_count_per_sec"] = round((disk_io.write_count - _prev_disk_counters.write_count) / dt, 1)
        _prev_disk_counters = disk_io
        _prev_disk_time = now
    except Exception:
        disk_rate = {"read_bytes_per_sec": 0, "write_bytes_per_sec": 0,
                     "read_count_per_sec": 0, "write_count_per_sec": 0}

    # Process count
    try:
        process_count = len(psutil.pids())
    except Exception:
        process_count = 0

    # Thread count
    try:
        thread_count = sum(p.num_threads() for p in psutil.process_iter(['num_threads'])
                          if p.info.get('num_threads'))
    except Exception:
        thread_count = 0

    # Handle count (Windows) or file descriptors (Linux)
    handle_count = 0
    if platform.system() == "Windows":
        try:
            import subprocess
            result = subprocess.run(
                ["wmic", "os", "get", "NumberOfProcesses", "/value"],
                capture_output=True, text=True, timeout=5
            )
            for line in result.stdout.splitlines():
                if "NumberOfProcesses" in line:
                    handle_count = int(line.split("=")[1].strip())
        except Exception:
            pass

    return {
        "timestamp": timestamp,
        "cpu_percent": cpu_overall,
        "cpu_per_core": cpu_per_core,
        "cpu_freq_mhz": round(cpu_freq.current, 0) if cpu_freq else 0,
        "memory_percent": mem.percent,
        "memory_used": mem.used,
        "memory_available": mem.available,
        "swap_percent": swap.percent,
        "swap_used": swap.used,
        "network_rate": net_rate,
        "disk_io_rate": disk_rate,
        "process_count": process_count,
        "thread_count": thread_count,
        "handle_count": handle_count,
    }


# ---------------------------------------------------------------------------
# API Communication
# ---------------------------------------------------------------------------

class DashboardClient:
    """Handles communication with the dashboard server."""

    def __init__(self, cfg: dict, logger: logging.Logger):
        self.cfg = cfg
        self.base_url = cfg["dashboard_url"].rstrip("/")
        self.server_id = cfg["server_id"]
        self.api_key = cfg["api_key"]
        self.verify_ssl = cfg["verify_ssl"]
        self.timeout = cfg.get("request_timeout_seconds", 30)
        self.retry_attempts = cfg["retry_attempts"]
        self.retry_delay = cfg["retry_delay_seconds"]
        self.logger = logger
        self.offline_buffer: deque = deque(maxlen=cfg["offline_buffer_max"])

    def _auth_header(self) -> dict:
        return {
            "Authorization": f"Bearer {self.server_id}:{self.api_key}",
            "Content-Type": "application/json",
        }

    def register(self) -> tuple:
        """Register this server with the dashboard. Returns (server_id, api_key)."""
        info = get_system_info(self.cfg)
        url = f"{self.base_url}/api/register"
        self.logger.info(f"Registering with dashboard at {url}")

        response = requests.post(
            url,
            json=info,
            timeout=self.timeout,
            verify=self.verify_ssl,
        )
        response.raise_for_status()
        data = response.json()
        return data["server_id"], data["api_key"]

    def send_metrics(self, payload: dict) -> bool:
        """Send metrics to the dashboard with retry logic."""
        url = f"{self.base_url}/api/metrics"

        for attempt in range(1, self.retry_attempts + 1):
            try:
                response = requests.post(
                    url,
                    json=payload,
                    headers=self._auth_header(),
                    timeout=self.timeout,
                    verify=self.verify_ssl,
                )
                if response.status_code == 200:
                    self.logger.info("Metrics sent successfully")
                    # Flush offline buffer if any
                    self._flush_buffer()
                    return True
                elif response.status_code == 401:
                    self.logger.error("Authentication failed. Check server_id and api_key in config.")
                    return False
                else:
                    self.logger.warning(
                        f"Attempt {attempt}: Server returned {response.status_code}"
                    )
            except requests.exceptions.ConnectionError:
                self.logger.warning(
                    f"Attempt {attempt}: Dashboard unreachable"
                )
            except requests.exceptions.Timeout:
                self.logger.warning(
                    f"Attempt {attempt}: Request timed out"
                )
            except Exception as e:
                self.logger.warning(
                    f"Attempt {attempt}: Error - {e}"
                )

            if attempt < self.retry_attempts:
                time.sleep(self.retry_delay)

        # All retries failed — buffer the payload
        self.logger.warning("All retries failed. Buffering payload for later.")
        self.offline_buffer.append(payload)
        return False

    def ping(self) -> bool:
        """Send a lightweight heartbeat ping to the dashboard."""
        url = f"{self.base_url}/api/ping"
        try:
            response = requests.post(
                url,
                headers=self._auth_header(),
                timeout=min(self.timeout, 10),
                verify=self.verify_ssl,
            )
            return response.status_code == 200
        except Exception:
            return False

    def fetch_pending_config(self) -> dict | None:
        """Poll the dashboard for pending config changes. Returns config dict or None."""
        url = f"{self.base_url}/api/config/{self.server_id}"
        try:
            response = requests.get(
                url,
                headers=self._auth_header(),
                timeout=min(self.timeout, 10),
                verify=self.verify_ssl,
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("has_update") and data.get("config"):
                    return data["config"]
            return None
        except Exception:
            return None

    def confirm_config_applied(self) -> bool:
        """Tell the dashboard we applied the pending config."""
        url = f"{self.base_url}/api/config/{self.server_id}"
        try:
            response = requests.post(
                url,
                headers=self._auth_header(),
                timeout=min(self.timeout, 10),
                verify=self.verify_ssl,
            )
            return response.status_code == 200
        except Exception:
            return False

    def send_live_metrics(self, payload: dict) -> bool:
        """Send live performance metrics to the dashboard (no retry, fire-and-forget)."""
        url = f"{self.base_url}/api/metrics/live"
        try:
            response = requests.post(
                url,
                json=payload,
                headers=self._auth_header(),
                timeout=min(self.timeout, 10),
                verify=self.verify_ssl,
            )
            return response.status_code == 200
        except Exception:
            return False

    def _flush_buffer(self):
        """Try to send buffered payloads."""
        if not self.offline_buffer:
            return

        self.logger.info(f"Flushing {len(self.offline_buffer)} buffered payloads")
        url = f"{self.base_url}/api/metrics"
        sent = 0

        while self.offline_buffer:
            payload = self.offline_buffer[0]
            try:
                response = requests.post(
                    url,
                    json=payload,
                    headers=self._auth_header(),
                    timeout=self.timeout,
                    verify=self.verify_ssl,
                )
                if response.status_code == 200:
                    self.offline_buffer.popleft()
                    sent += 1
                else:
                    break
            except Exception:
                break

        if sent > 0:
            self.logger.info(f"Flushed {sent} buffered payloads")


# ---------------------------------------------------------------------------
# Main Agent Loop
# ---------------------------------------------------------------------------

def _handle_signal(signum, frame):
    """Handle termination signals for graceful shutdown."""
    _shutdown_event.set()


def _reload_config(cfg: dict, logger: logging.Logger) -> dict:
    """Hot-reload config.json if it has changed."""
    try:
        new_cfg = load_config()
        changed = []
        for key in ("collection_interval_minutes", "top_processes_count",
                    "monitored_services", "retry_attempts", "retry_delay_seconds",
                    "collect_processes", "collect_disks", "collect_network",
                    "ping_enabled", "request_timeout_seconds", "log_level",
                    "auto_discover_services", "live_enabled", "live_interval_seconds"):
            if new_cfg.get(key) != cfg.get(key):
                changed.append(key)
        if changed:
            logger.info(f"Config reloaded — changed keys: {changed}")
            return new_cfg
    except Exception as e:
        logger.warning(f"Config reload failed: {e}")
    return cfg


def main():
    cfg = load_config()
    logger = setup_logging(cfg)

    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    logger.info("=" * 60)
    logger.info("Server Monitor Agent starting")
    logger.info(f"Platform: {platform.system()} {platform.release()}")
    logger.info(f"Hostname: {socket.gethostname()}")
    logger.info(f"Dashboard: {cfg['dashboard_url']}")
    logger.info(f"Interval: {cfg['collection_interval_minutes']} minutes")
    logger.info(f"Monitored services: {cfg['monitored_services']}")
    logger.info(f"Auto-discover services: {cfg.get('auto_discover_services', True)}")
    logger.info(f"Live mode: {'ENABLED' if cfg.get('live_enabled') else 'DISABLED'}")
    if cfg.get('live_enabled'):
        logger.info(f"Live interval: {cfg.get('live_interval_seconds', 10)}s")
    logger.info("=" * 60)

    client = DashboardClient(cfg, logger)

    # Auto-register if no server_id configured
    if not cfg["server_id"] or not cfg["api_key"]:
        logger.info("No server_id/api_key found. Attempting auto-registration...")
        while not _shutdown_event.is_set():
            try:
                server_id, api_key = client.register()
                cfg["server_id"] = server_id
                cfg["api_key"] = api_key
                save_config(cfg)
                client.server_id = server_id
                client.api_key = api_key
                logger.info(f"Registered successfully. Server ID: {server_id}")
                logger.info("API key saved to config.json")
                break
            except Exception as e:
                logger.error(f"Registration failed: {e}")
                logger.error("Retrying in 60 seconds... (Ctrl+C to stop)")
                _shutdown_event.wait(60)

    if _shutdown_event.is_set():
        logger.info("Shutdown requested during registration. Exiting.")
        return

    # Start live collection thread if enabled
    live_thread = None
    live_stop_event = threading.Event()

    def _live_collection_loop():
        """Background thread for near-live performance data collection."""
        logger.info("Live performance collection thread started")
        # Prime the CPU percent counter
        psutil.cpu_percent(interval=0)
        psutil.cpu_percent(interval=0, percpu=True)
        time.sleep(0.5)

        while not _shutdown_event.is_set() and not live_stop_event.is_set():
            interval = cfg.get("live_interval_seconds", 10)
            try:
                snapshot = collect_live_metrics()
                ok = client.send_live_metrics(snapshot)
                if not ok:
                    logger.debug("Live metrics send failed (will retry next tick)")
            except Exception as e:
                logger.debug(f"Live collection error: {e}")

            # Sleep in small increments so we can respond to shutdown quickly
            for _ in range(int(interval * 10)):
                if _shutdown_event.is_set() or live_stop_event.is_set():
                    break
                time.sleep(0.1)

        logger.info("Live performance collection thread stopped")

    if cfg.get("live_enabled", False):
        live_thread = threading.Thread(target=_live_collection_loop, daemon=True, name="live-collector")
        live_thread.start()

    interval_seconds = cfg["collection_interval_minutes"] * 60
    cycle_count = 0
    logger.info(f"Starting collection loop (every {cfg['collection_interval_minutes']} minutes)")

    while not _shutdown_event.is_set():
        cycle_count += 1

        # Hot-reload config every cycle
        cfg = _reload_config(cfg, logger)

        # Poll dashboard for remote config changes
        try:
            remote_cfg = client.fetch_pending_config()
            if remote_cfg:
                applied = []
                for key, value in remote_cfg.items():
                    if key in cfg and cfg[key] != value:
                        cfg[key] = value
                        applied.append(f"{key}={value}")
                    elif key not in cfg:
                        cfg[key] = value
                        applied.append(f"{key}={value} (new)")
                if applied:
                    save_config(cfg)
                    client.confirm_config_applied()
                    logger.info(f"Applied remote config from dashboard: {', '.join(applied)}")
                else:
                    client.confirm_config_applied()
                    logger.debug("Remote config received but no changes needed")
        except Exception as e:
            logger.debug(f"Remote config poll failed: {e}")

        interval_seconds = cfg["collection_interval_minutes"] * 60
        client.cfg = cfg
        client.retry_attempts = cfg["retry_attempts"]
        client.retry_delay = cfg["retry_delay_seconds"]
        client.timeout = cfg.get("request_timeout_seconds", 30)

        try:
            logger.info(f"[Cycle {cycle_count}] Collecting metrics...")

            # Collect all data
            metrics = collect_metrics(cfg)
            processes = collect_top_processes(cfg["top_processes_count"]) if cfg.get("collect_processes", True) else []
            services = collect_services(cfg["monitored_services"], cfg.get("auto_discover_services", True))

            payload = {
                "metrics": metrics,
                "processes": processes,
                "services": services,
            }

            logger.info(
                f"CPU: {metrics['cpu_percent']:.1f}% | "
                f"Memory: {metrics['memory_percent']:.1f}% | "
                f"Processes: {len(processes)} | "
                f"Services: {len(services)}"
            )

            # Send to dashboard
            client.send_metrics(payload)

        except Exception as e:
            logger.error(f"Collection error: {e}", exc_info=True)

        # Send heartbeat ping halfway through the interval
        half_interval = interval_seconds / 2
        logger.info(f"Next collection in {cfg['collection_interval_minutes']} minutes")
        if _shutdown_event.wait(half_interval):
            break

        # Mid-cycle heartbeat
        if not _shutdown_event.is_set() and cfg.get("ping_enabled", True):
            if client.ping():
                logger.debug("Heartbeat ping OK")
            else:
                logger.warning("Heartbeat ping failed")

        if _shutdown_event.wait(half_interval):
            break

    # Stop live collection thread
    live_stop_event.set()
    if live_thread and live_thread.is_alive():
        live_thread.join(timeout=5)
        logger.info("Live collection thread joined")

    logger.info("=" * 60)
    logger.info(f"Agent shutting down gracefully after {cycle_count} cycles.")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
