import React from 'react';
import { Bus, MapPin, Bell, Calendar, Inbox } from 'lucide-react';
import Button from './Button';

const iconMap = {
  shuttle: Bus,
  route: MapPin,
  notification: Bell,
  schedule: Calendar,
  default: Inbox,
};

export const EmptyState = ({
  icon = 'default',
  title = 'No items found',
  description = 'There are no records to display at this time.',
  actionLabel,
  onAction,
  className = ''
}) => {
  const IconComponent = iconMap[icon] || iconMap.default;

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-brand-500 dark:text-blue-400 flex items-center justify-center mb-4 border border-blue-100 dark:border-blue-900/50 shadow-subtle">
        <IconComponent className="w-7 h-7" />
      </div>
      <h3 className="text-base font-bold text-navy-900 dark:text-white">
        {title}
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-5 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
