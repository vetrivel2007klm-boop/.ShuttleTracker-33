import React from 'react';
import Card from '../common/Card';
import Badge from '../common/Badge';
import { Clock, Navigation, MapPin } from 'lucide-react';

export const ETACard = ({
  shuttleCode = 'S01',
  shuttleName = 'Campus Express',
  nextStop = 'Main Gate',
  etaMinutes = 4,
  distanceKm = 1.8,
  status = 'on_time',
  className = '',
  compact = false
}) => {
  const getStatusBorder = () => {
    switch (status) {
      case 'delayed':
        return 'border-amber-200 dark:border-amber-800/80 bg-amber-50/30 dark:bg-amber-950/20';
      case 'danger':
        return 'border-rose-200 dark:border-rose-800/80 bg-rose-50/30 dark:bg-rose-950/20';
      default:
        return 'border-blue-200/60 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10';
    }
  };

  const getEtaColor = () => {
    if (status === 'delayed') return 'text-amber-600 dark:text-amber-400';
    if (status === 'danger') return 'text-rose-600 dark:text-rose-400';
    return 'text-brand-500 dark:text-accent-blue';
  };

  if (compact) {
    return (
      <div className={`flex items-center justify-between p-3 rounded-xl border ${getStatusBorder()} ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-500/10 dark:bg-brand-500/20 text-brand-500 flex items-center justify-center font-bold text-sm">
            {shuttleCode}
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Next: <span className="font-semibold text-slate-800 dark:text-slate-200">{nextStop}</span></p>
            <p className="text-xs text-slate-400">{distanceKm} km away</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-base font-extrabold ${getEtaColor()}`}>{etaMinutes} min</div>
          <Badge status={status} withDot={false} className="text-[10px] py-0 px-2" />
        </div>
      </div>
    );
  }

  return (
    <Card className={`border shadow-premium ${getStatusBorder()} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-500 text-white flex items-center justify-center font-extrabold text-xs shadow-sm">
            {shuttleCode}
          </div>
          <div>
            <h4 className="text-sm font-bold text-navy-900 dark:text-white leading-tight">
              {shuttleName}
            </h4>
            <span className="text-[11px] text-slate-400">Institutional Transit</span>
          </div>
        </div>
        <Badge status={status} />
      </div>

      {/* Main ETA Metrics */}
      <div className="grid grid-cols-2 gap-4 my-4 py-2 bg-white/70 dark:bg-slate-900/70 rounded-xl px-4 border border-slate-100/80 dark:border-slate-800">
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase tracking-wide">
            <Clock className="w-3.5 h-3.5 text-brand-500" />
            Estimated Arrival
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-3xl font-black tracking-tight ${getEtaColor()}`}>
              {etaMinutes}
            </span>
            <span className="text-xs font-semibold text-slate-500">mins</span>
          </div>
        </div>

        <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-4">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase tracking-wide">
            <Navigation className="w-3.5 h-3.5 text-brand-500" />
            Distance
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-black text-navy-900 dark:text-white tracking-tight">
              {distanceKm}
            </span>
            <span className="text-xs font-semibold text-slate-500">km</span>
          </div>
        </div>
      </div>

      {/* Next Stop Indicator */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-500 flex items-center justify-center shrink-0">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Approaching Next Stop</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              {nextStop}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ETACard;
