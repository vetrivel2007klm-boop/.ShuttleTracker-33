import React from 'react';

export const Input = ({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  icon: Icon,
  disabled = false,
  required = false,
  className = '',
  ...props
}) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <div className="relative rounded-xl shadow-subtle">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          required={required}
          className={`block w-full rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm transition-all duration-150 py-2.5 ${
            Icon ? 'pl-10' : 'pl-3.5'
          } pr-3.5 ${
            error
              ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
              : 'border-slate-200 dark:border-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
          } disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
};

export const Select = ({
  label,
  id,
  value,
  onChange,
  options = [],
  error,
  disabled = false,
  required = false,
  className = '',
  ...props
}) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`block w-full rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm py-2.5 px-3.5 transition-all duration-150 ${
          error
            ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
            : 'border-slate-200 dark:border-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
        } disabled:bg-slate-50 disabled:cursor-not-allowed`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
};

export default Input;
