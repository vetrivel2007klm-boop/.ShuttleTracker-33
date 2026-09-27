import React from 'react';

const badgeStyles = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
  on_time: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
  on_trip: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
  live: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
  delayed: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
  idle: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  not_started: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  danger: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
  info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800',
};

const dotStyles = {
  active: 'bg-emerald-500',
  on_time: 'bg-emerald-500',
  on_trip: 'bg-blue-500 animate-pulse',
  live: 'bg-blue-500 animate-pulse',
  delayed: 'bg-amber-500 animate-pulse',
  pending: 'bg-amber-500',
  idle: 'bg-slate-400',
  not_started: 'bg-slate-400',
  inactive: 'bg-slate-400',
  danger: 'bg-rose-500 animate-ping',
  info: 'bg-sky-500',
};

const defaultLabels = {
  on_trip: 'On Trip',
  idle: 'Trip Not Started',
  not_started: 'Trip Not Started',
  pending: 'Not Logged In Yet'
};

export const Badge = ({
  status = 'active',
  children,
  withDot = true,
  className = ''
}) => {
  const normalized = String(status).toLowerCase().replace(/\s+/g, '_');
  const style = badgeStyles[normalized] || badgeStyles.inactive;
  const dotColor = dotStyles[normalized] || 'bg-slate-400';
  const labelText = children || defaultLabels[normalized] || status.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${style} ${className}`}
    >
      {withDot && (
        <span className="relative flex h-2 w-2">
          {['on_trip', 'live', 'delayed'].includes(normalized) && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
        </span>
      )}
      <span className="capitalize">{labelText}</span>
    </span>
  );
};

export default Badge;
