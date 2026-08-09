'use client';

import { useState, type ChangeEventHandler } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';

interface PasswordFieldProps {
  id: string;
  name?: string;
  label: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  autoComplete: 'current-password' | 'new-password';
  placeholder: string;
  showPasswordLabel: string;
  hidePasswordLabel: string;
  describedBy?: string;
  helpText?: string;
  helpTextId?: string;
  invalid?: boolean;
  minLength?: number;
  maxLength?: number;
  dark?: boolean;
  accent?: 'blue' | 'amber';
}

export default function PasswordField({
  id,
  name = 'password',
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  showPasswordLabel,
  hidePasswordLabel,
  describedBy,
  helpText,
  helpTextId,
  invalid = false,
  minLength,
  maxLength,
  dark = false,
  accent = 'blue',
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const descriptionIds = [describedBy, helpText ? helpTextId : undefined]
    .filter(Boolean)
    .join(' ') || undefined;
  const fieldColors = dark
    ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-500'
    : 'bg-slate-50 border-slate-300 text-slate-950 placeholder:text-slate-500';
  const labelColor = dark ? 'text-slate-200' : 'text-slate-700';
  const focusColor =
    accent === 'amber'
      ? 'focus:border-amber-400 focus:ring-amber-400/35'
      : 'focus:border-blue-500 focus:ring-blue-500/30';

  return (
    <div>
      <label
        htmlFor={id}
        className={`block text-xs font-bold ${labelColor}`}
      >
        {label}
      </label>
      <div className="relative mt-1.5">
        <LockKeyhole
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        />
        <input
          id={id}
          name={name}
          type={isVisible ? 'text' : 'password'}
          autoComplete={autoComplete}
          spellCheck={false}
          required
          minLength={minLength}
          maxLength={maxLength}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-describedby={descriptionIds}
          aria-invalid={invalid}
          className={`w-full rounded-xl border py-3 pl-10 pr-12 text-sm font-normal normal-case tracking-normal outline-none transition placeholder:font-normal focus:ring-4 ${fieldColors} ${focusColor} ${
            invalid ? 'border-rose-500' : ''
          }`}
        />
        <button
          type="button"
          aria-label={isVisible ? hidePasswordLabel : showPasswordLabel}
          title={isVisible ? hidePasswordLabel : showPasswordLabel}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((visible) => !visible)}
          className={`absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            dark
              ? `text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:ring-offset-slate-950 ${
                  accent === 'amber'
                    ? 'focus-visible:ring-amber-400'
                    : 'focus-visible:ring-blue-400'
                }`
              : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900 focus-visible:ring-blue-600 focus-visible:ring-offset-white'
          }`}
        >
          {isVisible ? (
            <EyeOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Eye aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </div>
      {helpText && helpTextId && (
        <p id={helpTextId} className={`mt-2 text-xs leading-relaxed ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
          {helpText}
        </p>
      )}
    </div>
  );
}
