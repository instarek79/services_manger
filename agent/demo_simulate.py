#!/usr/bin/env python3
"""
Demo script that simulates multiple server agents sending metrics to the dashboard.
Use this to populate the dashboard with realistic test data.

Usage:
    python demo_simulate.py [--url http://localhost:3000] [--count 5] [--rounds 10] [--live]
"""

import argparse
import json
import random
import time
from datetime import datetime, timedelta

import requests

# Simulated server profiles
SERVER_PROFILES = [
    {
        "hostname": "web-server-01",
        "ip_address": "192.168.1.10",
        "os_info": "Windows Server 2022 AMD64",
        "group": "Web Servers",
        "base_cpu": 35,
        "base_mem": 55,
        "disks": [
            {"device": "C:\\", "mountpoint": "C:\\", "total": 500 * 1024**3, "base_percent": 45},
            {"device": "D:\\", "mountpoint": "D:\\", "total": 1000 * 1024**3, "base_percent": 30},
        ],
        "services": ["W3SVC", "wuauserv", "Spooler", "MSSQLSERVER"],
    },
    {
        "hostname": "db-server-01",
        "ip_address": "192.168.1.20",
        "os_info": "Ubuntu 22.04 x86_64",
        "group": "Database Servers",
        "base_cpu": 50,
        "base_mem": 72,
        "disks": [
            {"device": "/dev/sda1", "mountpoint": "/", "total": 200 * 1024**3, "base_percent": 55},
            {"device": "/dev/sdb1", "mountpoint": "/data", "total": 2000 * 1024**3, "base_percent": 68},
        ],
        "services": ["postgresql", "redis-server", "docker"],
    },
    {
        "hostname": "app-server-01",
        "ip_address": "192.168.1.30",
        "os_info": "Windows Server 2019 AMD64",
        "group": "Application Servers",
        "base_cpu": 42,
        "base_mem": 61,
        "disks": [
            {"device": "C:\\", "mountpoint": "C:\\", "total": 256 * 1024**3, "base_percent": 60},
            {"device": "E:\\", "mountpoint": "E:\\", "total": 500 * 1024**3, "base_percent": 40},
        ],
        "services": ["W3SVC", "MSMQ", "Spooler"],
    },
    {
        "hostname": "api-gateway-01",
        "ip_address": "192.168.1.40",
        "os_info": "Ubuntu 24.04 x86_64",
        "group": "Web Servers",
        "base_cpu": 25,
        "base_mem": 40,
        "disks": [
            {"device": "/dev/sda1", "mountpoint": "/", "total": 100 * 1024**3, "base_percent": 35},
        ],
        "services": ["nginx", "docker", "sshd"],
    },
    {
        "hostname": "file-server-01",
        "ip_address": "192.168.1.50",
        "os_info": "Windows Server 2022 AMD64",
        "group": "Storage",
        "base_cpu": 15,
        "base_mem": 35,
        "disks": [
            {"device": "C:\\", "mountpoint": "C:\\", "total": 256 * 1024**3, "base_percent": 30},
            {"device": "D:\\", "mountpoint": "D:\\", "total": 4000 * 1024**3, "base_percent": 72},
            {"device": "E:\\", "mountpoint": "E:\\", "total": 4000 * 1024**3, "base_percent": 85},
        ],
        "services": ["LanmanServer", "Spooler", "wuauserv"],
    },
    {
        "hostname": "monitoring-01",
        "ip_address": "192.168.1.60",
        "os_info": "Ubuntu 22.04 x86_64",
        "group": "Infrastructure",
        "base_cpu": 20,
        "base_mem": 45,
        "disks": [
            {"device": "/dev/sda1", "mountpoint": "/", "total": 200 * 1024**3, "base_percent": 40},
        ],
        "services": ["grafana-server", "prometheus", "docker", "sshd"],
    },
    {
        "hostname": "ci-runner-01",
        "ip_address": "192.168.1.70",
        "os_info": "Ubuntu 24.04 x86_64",
        "group": "Infrastructure",
        "base_cpu": 60,
        "base_mem": 78,
        "disks": [
            {"device": "/dev/sda1", "mountpoint": "/", "total": 500 * 1024**3, "base_percent": 55},
        ],
        "services": ["gitlab-runner", "docker", "sshd"],
    },
    {
        "hostname": "mail-server-01",
        "ip_address": "192.168.1.80",
        "os_info": "Windows Server 2019 AMD64",
        "group": "Application Servers",
        "base_cpu": 18,
        "base_mem": 50,
        "disks": [
            {"device": "C:\\", "mountpoint": "C:\\", "total": 256 * 1024**3, "base_percent": 40},
            {"device": "D:\\", "mountpoint": "D:\\", "total": 1000 * 1024**3, "base_percent": 55},
        ],
        "services": ["MSExchangeIS", "MSExchangeTransport", "W3SVC"],
    },
]

PROCESS_NAMES = [
    "python.exe", "node.exe", "java.exe", "sqlservr.exe", "w3wp.exe",
    "nginx", "postgres", "redis-server", "dockerd", "sshd",
    "chrome.exe", "explorer.exe", "svchost.exe", "System",
    "httpd", "mysqld", "mongod", "elasticsearch", "kibana",
    "gitlab-runner", "prometheus", "grafana-server", "containerd",
]


def jitter(base: float, variance: float = 15) -> float:
    """Add random variance to a base value, clamped 0-100."""
    return max(0, min(100, base + random.uniform(-variance, variance)))


def generate_metrics(profile: dict) -> dict:
    cpu = jitter(profile["base_cpu"])
    mem_percent = jitter(profile["base_mem"])
    mem_total = 16 * 1024**3  # 16 GB
    if "db" in profile["hostname"]:
        mem_total = 64 * 1024**3
    elif "ci" in profile["hostname"]:
        mem_total = 32 * 1024**3

    mem_used = int(mem_total * mem_percent / 100)
    mem_free = mem_total - mem_used

    disks = []
    for d in profile["disks"]:
        pct = jitter(d["base_percent"], 5)
        used = int(d["total"] * pct / 100)
        disks.append({
            "device": d["device"],
            "mountpoint": d["mountpoint"],
            "total": d["total"],
            "used": used,
            "free": d["total"] - used,
            "percent": round(pct, 1),
        })

    return {
        "cpu_percent": round(cpu, 1),
        "memory_total": mem_total,
        "memory_used": mem_used,
        "memory_free": mem_free,
        "memory_percent": round(mem_percent, 1),
        "disks": disks,
        "network": {
            "bytes_sent": random.randint(100_000_000, 50_000_000_000),
            "bytes_recv": random.randint(100_000_000, 50_000_000_000),
            "packets_sent": random.randint(100_000, 10_000_000),
            "packets_recv": random.randint(100_000, 10_000_000),
        },
        "uptime_seconds": random.randint(3600, 30 * 86400),
        "boot_time": (datetime.now() - timedelta(seconds=random.randint(3600, 30 * 86400))).isoformat(),
    }


def generate_processes(count: int = 15) -> list:
    procs = []
    for _ in range(count):
        name = random.choice(PROCESS_NAMES)
        procs.append({
            "pid": random.randint(100, 65000),
            "name": name,
            "cpu_percent": round(random.uniform(0, 40), 1),
            "memory_percent": round(random.uniform(0.1, 15), 1),
            "memory_mb": round(random.uniform(5, 2000), 1),
            "status": random.choice(["running", "running", "running", "sleeping"]),
            "username": random.choice(["SYSTEM", "Administrator", "root", "www-data", "postgres"]),
        })
    procs.sort(key=lambda p: p["cpu_percent"], reverse=True)
    return procs


def generate_services(service_names: list) -> list:
    svcs = []
    for name in service_names:
        # Most services running, occasional stopped
        status = random.choices(["running", "stopped"], weights=[90, 10])[0]
        svcs.append({
            "service_name": name,
            "display_name": name.replace("-", " ").replace("_", " ").title(),
            "status": status,
            "start_type": random.choice(["automatic", "automatic", "manual"]),
            "pid": random.randint(1000, 60000) if status == "running" else 0,
        })
    return svcs


def generate_live_metrics(profile: dict) -> dict:
    """Generate a simulated live performance snapshot."""
    cpu = jitter(profile["base_cpu"])
    mem = jitter(profile["base_mem"])
    num_cores = random.choice([4, 8, 12, 16])
    cpu_per_core = [round(jitter(profile["base_cpu"], 25), 1) for _ in range(num_cores)]

    return {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "cpu_percent": round(cpu, 1),
        "cpu_per_core": cpu_per_core,
        "cpu_freq_mhz": random.choice([2400, 2800, 3200, 3600, 4000]),
        "memory_percent": round(mem, 1),
        "memory_used": int(16 * 1024**3 * mem / 100),
        "memory_available": int(16 * 1024**3 * (100 - mem) / 100),
        "swap_percent": round(random.uniform(0, 30), 1),
        "swap_used": random.randint(0, 2 * 1024**3),
        "network_rate": {
            "bytes_sent_per_sec": round(random.uniform(1000, 50_000_000), 1),
            "bytes_recv_per_sec": round(random.uniform(1000, 50_000_000), 1),
            "packets_sent_per_sec": round(random.uniform(10, 50000), 1),
            "packets_recv_per_sec": round(random.uniform(10, 50000), 1),
        },
        "disk_io_rate": {
            "read_bytes_per_sec": round(random.uniform(0, 100_000_000), 1),
            "write_bytes_per_sec": round(random.uniform(0, 80_000_000), 1),
            "read_count_per_sec": round(random.uniform(0, 5000), 1),
            "write_count_per_sec": round(random.uniform(0, 3000), 1),
        },
        "process_count": random.randint(80, 400),
        "thread_count": random.randint(500, 5000),
        "handle_count": random.randint(10000, 80000),
    }


def register_server(base_url: str, profile: dict) -> tuple:
    """Register a simulated server and return (server_id, api_key)."""
    resp = requests.post(f"{base_url}/api/register", json={
        "hostname": profile["hostname"],
        "ip_address": profile["ip_address"],
        "os_info": profile["os_info"],
    }, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    return data["server_id"], data["api_key"]


def send_metrics(base_url: str, server_id: str, api_key: str, payload: dict) -> bool:
    """Send metrics payload to dashboard."""
    resp = requests.post(
        f"{base_url}/api/metrics",
        json=payload,
        headers={
            "Authorization": f"Bearer {server_id}:{api_key}",
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    return resp.status_code == 200


def send_live_metrics(base_url: str, server_id: str, api_key: str, payload: dict) -> bool:
    """Send live metrics payload to dashboard."""
    resp = requests.post(
        f"{base_url}/api/metrics/live",
        json=payload,
        headers={
            "Authorization": f"Bearer {server_id}:{api_key}",
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    return resp.status_code == 200


def update_server_group(base_url: str, server_id: str, group: str):
    """Set the server group via dashboard API."""
    requests.patch(
        f"{base_url}/api/dashboard/server/{server_id}",
        json={"group_name": group},
        timeout=15,
    )


def main():
    parser = argparse.ArgumentParser(description="Simulate server agents for demo")
    parser.add_argument("--url", default="http://localhost:3000", help="Dashboard URL")
    parser.add_argument("--count", type=int, default=8, help="Number of servers (max 8)")
    parser.add_argument("--rounds", type=int, default=12, help="Number of metric rounds to send")
    parser.add_argument("--delay", type=float, default=2, help="Delay between rounds (seconds)")
    parser.add_argument("--live", action="store_true", help="Also send live performance metrics")
    parser.add_argument("--live-ticks", type=int, default=30, help="Number of live metric ticks per server (when --live)")
    args = parser.parse_args()

    profiles = SERVER_PROFILES[:min(args.count, len(SERVER_PROFILES))]
    print(f"Simulating {len(profiles)} servers sending to {args.url}")
    print(f"Rounds: {args.rounds}, Delay: {args.delay}s between rounds")
    if args.live:
        print(f"Live metrics: {args.live_ticks} ticks per server")
    print("=" * 60)

    # Register all servers
    servers = []
    for profile in profiles:
        try:
            server_id, api_key = register_server(args.url, profile)
            update_server_group(args.url, server_id, profile["group"])
            servers.append({
                "profile": profile,
                "server_id": server_id,
                "api_key": api_key,
            })
            print(f"  [OK] Registered {profile['hostname']} ({profile['group']})")
        except Exception as e:
            print(f"  [FAIL] {profile['hostname']}: {e}")

    if not servers:
        print("\nNo servers registered. Is the dashboard running?")
        return

    print(f"\n{len(servers)} servers registered. Sending metrics...\n")

    # Send metric rounds
    for round_num in range(1, args.rounds + 1):
        print(f"--- Round {round_num}/{args.rounds} ---")
        for srv in servers:
            profile = srv["profile"]
            metrics = generate_metrics(profile)
            processes = generate_processes()
            services = generate_services(profile["services"])

            payload = {
                "metrics": metrics,
                "processes": processes,
                "services": services,
            }

            ok = send_metrics(args.url, srv["server_id"], srv["api_key"], payload)
            status = "OK" if ok else "FAIL"
            print(f"  [{status}] {profile['hostname']}: CPU={metrics['cpu_percent']:.1f}% MEM={metrics['memory_percent']:.1f}%")

        if round_num < args.rounds:
            print(f"  Waiting {args.delay}s...")
            time.sleep(args.delay)

    # Send live metrics if requested
    if args.live:
        print(f"\nSending {args.live_ticks} live metric ticks...")
        for tick in range(1, args.live_ticks + 1):
            for srv in servers:
                profile = srv["profile"]
                live = generate_live_metrics(profile)
                ok = send_live_metrics(args.url, srv["server_id"], srv["api_key"], live)
                status = "OK" if ok else "FAIL"
                if tick == 1 or tick == args.live_ticks or tick % 10 == 0:
                    print(f"  [Tick {tick}] [{status}] {profile['hostname']}: CPU={live['cpu_percent']:.1f}%")
            if tick < args.live_ticks:
                time.sleep(1)
        print(f"Sent {args.live_ticks} live ticks for {len(servers)} servers.")

    print("\n" + "=" * 60)
    print(f"Demo complete! Open {args.url} to see the dashboard.")
    print(f"Sent {args.rounds} rounds of metrics for {len(servers)} servers.")
    if args.live:
        print(f"Sent {args.live_ticks} live performance ticks per server.")


if __name__ == "__main__":
    main()
