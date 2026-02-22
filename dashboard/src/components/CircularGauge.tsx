'use client';

interface CircularGaugeProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  sublabel?: string;
}

export default function CircularGauge({
  value,
  max = 100,
  size = 80,
  strokeWidth = 6,
  color,
  label,
  sublabel,
}: CircularGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.min(value / max, 1);
  const offset = circumference * (1 - percent);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-gray-200 dark:text-white/[0.08]"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {value.toFixed(0)}%
          </span>
        </div>
      </div>
      <span className="text-xs font-medium text-gray-400">{label}</span>
      {sublabel && (
        <span className="text-[10px] text-gray-500">{sublabel}</span>
      )}
    </div>
  );
}
