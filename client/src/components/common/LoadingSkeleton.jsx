import React from 'react';

export const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-xl ${className}`} />
);

export const CardSkeleton = () => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
    <div className="flex justify-between items-center">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-9 rounded-xl" />
    </div>
    <Skeleton className="h-8 w-36" />
    <Skeleton className="h-3 w-48 pt-2" />
  </div>
);

export const TableSkeleton = ({ rows = 5 }) => (
  <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden p-4 space-y-3">
    <div className="flex justify-between mb-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-8 w-24" />
    </div>
    {Array.from({ length: rows }).map((_, idx) => (
      <div key={idx} className="flex gap-4 items-center py-2 border-b border-slate-100 dark:border-slate-800/60 last:border-none">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    ))}
  </div>
);

export const MapSkeleton = () => (
  <div className="w-full h-full min-h-[400px] bg-slate-100 dark:bg-slate-900 rounded-2xl flex flex-col items-center justify-center border border-slate-200 dark:border-slate-800 animate-pulse p-6">
    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 mb-3" />
    <Skeleton className="h-5 w-48 mb-2" />
    <Skeleton className="h-3 w-64" />
  </div>
);

export default Skeleton;
