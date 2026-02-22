#!/usr/bin/env python3
"""
Install the Server Monitor Agent as a Windows service or Linux systemd service.
Run with administrator/root privileges.
"""

import os
import platform
import subprocess
import sys
from pathlib import Path

AGENT_DIR = Path(__file__).parent.resolve()
AGENT_SCRIPT = AGENT_DIR / "agent.py"
PYTHON_EXE = sys.executable
SERVICE_NAME = "ServerMonitorAgent"
SERVICE_DISPLAY = "Server Monitor Agent"
SERVICE_DESC = "Collects system metrics and sends them to the monitoring dashboard"


def install_windows():
    """Install as a Windows service using NSSM or Task Scheduler."""
    print("=" * 50)
    print("Windows Service Installation")
    print("=" * 50)

    # Option 1: Use Task Scheduler (no extra dependencies)
    print("\nCreating a Windows Scheduled Task...")
    task_xml = f"""<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>{SERVICE_DESC}</Description>
  </RegistrationInfo>
  <Triggers>
    <BootTrigger>
      <Enabled>true</Enabled>
    </BootTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>ServiceAccount</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT5M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{PYTHON_EXE}</Command>
      <Arguments>"{AGENT_SCRIPT}"</Arguments>
      <WorkingDirectory>{AGENT_DIR}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>"""

    task_file = AGENT_DIR / "task.xml"
    with open(task_file, "w", encoding="utf-16") as f:
        f.write(task_xml)

    result = subprocess.run(
        ["schtasks", "/create", "/tn", SERVICE_NAME, "/xml", str(task_file), "/f"],
        capture_output=True, text=True
    )

    if result.returncode == 0:
        print(f"[OK] Scheduled task '{SERVICE_NAME}' created successfully.")
        print(f"     The agent will start automatically on boot.")
        print(f"\n  To start now:   schtasks /run /tn {SERVICE_NAME}")
        print(f"  To stop:        schtasks /end /tn {SERVICE_NAME}")
        print(f"  To uninstall:   schtasks /delete /tn {SERVICE_NAME} /f")
    else:
        print(f"[ERROR] Failed to create scheduled task:")
        print(result.stderr)
        print("\nMake sure you are running as Administrator.")

    # Cleanup
    task_file.unlink(missing_ok=True)


def install_linux():
    """Install as a Linux systemd service."""
    print("=" * 50)
    print("Linux systemd Service Installation")
    print("=" * 50)

    service_content = f"""[Unit]
Description={SERVICE_DESC}
After=network.target
Wants=network-online.target

[Service]
Type=simple
ExecStart={PYTHON_EXE} {AGENT_SCRIPT}
WorkingDirectory={AGENT_DIR}
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal
SyslogIdentifier={SERVICE_NAME}

[Install]
WantedBy=multi-user.target
"""

    service_file = f"/etc/systemd/system/{SERVICE_NAME.lower()}.service"

    try:
        with open(service_file, "w") as f:
            f.write(service_content)

        subprocess.run(["systemctl", "daemon-reload"], check=True)
        subprocess.run(["systemctl", "enable", SERVICE_NAME.lower()], check=True)
        subprocess.run(["systemctl", "start", SERVICE_NAME.lower()], check=True)

        print(f"[OK] Service '{SERVICE_NAME.lower()}' installed and started.")
        print(f"\n  Status:     systemctl status {SERVICE_NAME.lower()}")
        print(f"  Logs:       journalctl -u {SERVICE_NAME.lower()} -f")
        print(f"  Stop:       systemctl stop {SERVICE_NAME.lower()}")
        print(f"  Uninstall:  systemctl disable {SERVICE_NAME.lower()} && rm {service_file}")
    except PermissionError:
        print("[ERROR] Permission denied. Run with sudo.")
    except Exception as e:
        print(f"[ERROR] {e}")


def uninstall():
    """Uninstall the service."""
    if platform.system() == "Windows":
        result = subprocess.run(
            ["schtasks", "/delete", "/tn", SERVICE_NAME, "/f"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            print(f"[OK] Task '{SERVICE_NAME}' removed.")
        else:
            print(f"[ERROR] {result.stderr}")
    else:
        svc = SERVICE_NAME.lower()
        subprocess.run(["systemctl", "stop", svc], capture_output=True)
        subprocess.run(["systemctl", "disable", svc], capture_output=True)
        service_file = f"/etc/systemd/system/{svc}.service"
        if os.path.exists(service_file):
            os.remove(service_file)
            subprocess.run(["systemctl", "daemon-reload"], capture_output=True)
        print(f"[OK] Service '{svc}' removed.")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "uninstall":
        uninstall()
    else:
        if platform.system() == "Windows":
            install_windows()
        else:
            install_linux()
