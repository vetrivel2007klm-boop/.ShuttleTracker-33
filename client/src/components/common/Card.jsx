import React from 'react';

export const Card = ({
  children,
  className = '',
  hover = false,
  onClick,
  ...props
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-subtle ${
        hover ? 'hover:shadow-premium hover:-translate-y-0.5 transition-all duration-200 cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
