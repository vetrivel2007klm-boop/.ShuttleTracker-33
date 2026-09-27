import React from 'react';
import Card from './Card';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue', // blue, green, amber, purple, rose
  trend = null, // { value: '+12%', isPositive: true }
  onClick
}) => {
  const colorSchemes = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-brand-500 dark:text-blue-400',
      border: 'border-blue-100 dark:border-blue-900/50'
    },
    green: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-100 dark:border-emerald-900/50'
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-100 dark:border-amber-900/50'
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-100 dark:border-purple-900/50'
    },
    rose: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-100 dark:border-rose-900/50'
    },
    slate: {
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-600 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700'
    }
  };

  const scheme = colorSchemes[color] || colorSchemes.blue;

  return (
    <Card hover={!!onClick} onClick={onClick} className="flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <h3 className="text-2xl lg:text-3xl font-bold text-navy-900 dark:text-white mt-1 tracking-tight">
            {value}
          </h3>
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl ${scheme.bg} ${scheme.text} border ${scheme.border} shrink-0`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
        {trend && (
          <span className={`inline-flex items-center gap-0.5 font-semibold ${trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {trend.isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {trend.value}
          </span>
        )}
        <span className="text-slate-500 dark:text-slate-400">
          {subtitle || 'Current status'}
        </span>
      </div>
    </Card>
  );
};

export default StatCard;
