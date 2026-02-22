'use client';

const shimmer = 'bg-gray-200 dark:bg-gray-800';
const shimmerFaint = 'bg-gray-100 dark:bg-gray-800/60';
const card = 'bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${card} p-4 h-20`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${shimmer}`} />
              <div className="space-y-2">
                <div className={`w-8 h-5 ${shimmer} rounded`} />
                <div className={`w-16 h-3 ${shimmerFaint} rounded`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3">
        <div className={`w-64 h-9 ${card}`} />
        <div className={`w-32 h-9 ${card}`} />
        <div className={`w-32 h-9 ${card}`} />
      </div>

      {/* Server cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={`${card} p-5`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-9 h-9 rounded-lg ${shimmer}`} />
              <div className="space-y-2 flex-1">
                <div className={`w-24 h-4 ${shimmer} rounded`} />
                <div className={`w-20 h-3 ${shimmerFaint} rounded`} />
              </div>
              <div className={`w-16 h-5 ${shimmer} rounded-full`} />
            </div>
            <div className="flex justify-around mb-4">
              <div className={`w-[70px] h-[70px] rounded-full border-4 border-gray-200 dark:border-gray-800`} />
              <div className={`w-[70px] h-[70px] rounded-full border-4 border-gray-200 dark:border-gray-800`} />
            </div>
            <div className="space-y-2">
              <div className={`w-full h-1.5 ${shimmer} rounded-full`} />
              <div className={`w-full h-1.5 ${shimmer} rounded-full`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ServerDetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className={`w-9 h-9 ${shimmer} rounded-lg`} />
        <div className="space-y-2 flex-1">
          <div className={`w-48 h-6 ${shimmer} rounded`} />
          <div className={`w-72 h-4 ${shimmerFaint} rounded`} />
        </div>
      </div>
      <div className={`flex gap-1 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-1 border border-gray-200 dark:border-gray-800`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`w-28 h-9 ${shimmer} rounded-md`} />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${card} p-4 h-36`} />
        ))}
      </div>
      <div className={`${card} p-4 h-72`} />
    </div>
  );
}
