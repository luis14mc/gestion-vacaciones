'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="form-control w-full">
        {label && (
          <label className="label" htmlFor={inputId}>
            <span className="label-text">{label}</span>
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`input input-bordered w-full ${error ? 'input-error' : ''} ${className}`}
          {...props}
        />
        {(error || helperText) && (
          <label className="label">
            <span className={`label-text-alt ${error ? 'text-error' : ''}`}>
              {error || helperText}
            </span>
          </label>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
