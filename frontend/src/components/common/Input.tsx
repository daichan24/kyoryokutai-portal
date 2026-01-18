import React from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            '[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:dark:invert',
            '[&::-webkit-datetime-edit]:dark:text-gray-100',
            '[&::-webkit-datetime-edit-fields-wrapper]:dark:text-gray-100',
            '[&::-webkit-datetime-edit-text]:dark:text-gray-100',
            '[&::-webkit-datetime-edit-month-field]:dark:text-gray-100',
            '[&::-webkit-datetime-edit-day-field]:dark:text-gray-100',
            '[&::-webkit-datetime-edit-year-field]:dark:text-gray-100',
            '[&::-webkit-datetime-edit-hour-field]:dark:text-gray-100',
            '[&::-webkit-datetime-edit-minute-field]:dark:text-gray-100',
            error && 'border-error dark:border-red-500',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-error dark:text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
