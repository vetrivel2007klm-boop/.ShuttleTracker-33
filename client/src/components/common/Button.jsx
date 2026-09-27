import React from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'bg-brand-500 hover:bg-brand-600 text-white shadow-sm hover:shadow active:scale-[0.98]',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 active:scale-[0.98]',
  accent: 'bg-accent-blue hover:bg-sky-400 text-navy-900 font-semibold shadow-sm active:scale-[0.98]',
  outline: 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98]',
  danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm active:scale-[0.98]',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-[0.98]',
  ghost: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-xl font-medium',
  md: 'px-4 py-2.5 text-sm rounded-xl font-medium',
  lg: 'px-6 py-3 text-base rounded-2xl font-semibold',
  xl: 'px-8 py-4 text-lg rounded-2xl font-semibold',
};

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  icon: Icon,
  type = 'button',
  onClick,
  ...props
}) => {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      <span>{children}</span>
    </button>
  );
};

export default Button;
