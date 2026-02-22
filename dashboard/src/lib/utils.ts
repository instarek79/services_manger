export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString + 'Z');
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'online': return 'text-emerald-500';
    case 'warning': return 'text-amber-500';
    case 'critical': return 'text-red-500';
    case 'offline': return 'text-gray-400';
    default: return 'text-gray-400';
  }
}

export function getStatusBg(status: string): string {
  switch (status) {
    case 'online': return 'bg-emerald-500/10 border-emerald-500/30';
    case 'warning': return 'bg-amber-500/10 border-amber-500/30';
    case 'critical': return 'bg-red-500/10 border-red-500/30';
    case 'offline': return 'bg-gray-500/10 border-gray-500/30';
    default: return 'bg-gray-500/10 border-gray-500/30';
  }
}

export function getStatusDot(status: string): string {
  switch (status) {
    case 'online': return 'bg-emerald-500';
    case 'warning': return 'bg-amber-500';
    case 'critical': return 'bg-red-500 animate-pulse';
    case 'offline': return 'bg-gray-400';
    default: return 'bg-gray-400';
  }
}

export function getCpuColor(percent: number): string {
  if (percent >= 90) return '#ef4444';
  if (percent >= 70) return '#f59e0b';
  return '#10b981';
}

export function getMemoryColor(percent: number): string {
  if (percent >= 90) return '#ef4444';
  if (percent >= 70) return '#f59e0b';
  return '#3b82f6';
}

export function getDiskColor(percent: number): string {
  if (percent >= 90) return '#ef4444';
  if (percent >= 70) return '#f59e0b';
  return '#8b5cf6';
}

const VIRTUAL_FS_TYPES = new Set(['squashfs', 'tmpfs', 'devtmpfs', 'overlay', 'aufs', 'iso9660', 'ramfs']);
const SKIP_MOUNT_PREFIXES = ['/snap/', '/sys/', '/proc/', '/run/', '/dev/'];
const SKIP_DEVICE_PREFIXES = ['/dev/loop'];

export function isRealDisk(disk: { device?: string; mountpoint?: string; fstype?: string }): boolean {
  if (disk.fstype && VIRTUAL_FS_TYPES.has(disk.fstype.toLowerCase())) return false;
  if (disk.mountpoint && SKIP_MOUNT_PREFIXES.some(p => disk.mountpoint!.startsWith(p))) return false;
  if (disk.device && SKIP_DEVICE_PREFIXES.some(p => disk.device!.startsWith(p))) return false;
  return true;
}

export function filterRealDisks<T extends { device?: string; mountpoint?: string; fstype?: string }>(disks: T[]): T[] {
  return disks.filter(isRealDisk);
}
