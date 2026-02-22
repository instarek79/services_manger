'use client';

import { cn, getStatusDot } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <span className={cn('inline-flex items-center gap-1.5', textSize)}>
      <span className={cn('rounded-full', dotSize, getStatusDot(status))} />
      <span className="capitalize font-medium text-gray-600 dark:text-gray-300">
        {label || status}
      </span>
    </span>
  );
}
