'use client';

import React, { useId } from 'react';
import { BellRing } from 'lucide-react';
import { useBranded } from '@/components/brand/BrandProvider';
import { useAppStore } from '@/lib/store';
import { extraUserMessages } from '@/lib/user-i18n';
import type { WebPushStatus } from '@/lib/support/web-push';
import { useSupport } from './SupportProvider';

interface WebPushSettingsProps {
  className?: string;
}

export default function WebPushSettings({ className = '' }: WebPushSettingsProps) {
  const titleId = useId();
  const descriptionId = useId();
  const { language, role } = useAppStore();
  // The existing back-office UI is French-only; customer surfaces follow the
  // active preference. Keeping this rule central also covers future placements.
  const effectiveLanguage = role === 'admin' ? 'fr' : language;
  const copy = useBranded(extraUserMessages[effectiveLanguage].support);
  const { webPushStatus, enablePush, disablePush } = useSupport();
  const pushBusy = ['loading', 'enabling', 'disabling'].includes(webPushStatus);
  const pushUnavailable = ['unsupported', 'denied'].includes(webPushStatus);
  const pushStatusMessage: Record<WebPushStatus, string> = {
    loading: copy.pushChecking,
    unsupported: copy.pushUnsupported,
    prompt: copy.pushDescription,
    denied: copy.pushDenied,
    subscribed: copy.pushEnabled,
    enabling: copy.pushEnabling,
    disabling: copy.pushDisabling,
    error: copy.pushError,
  };

  return (
    <section
      aria-labelledby={titleId}
      className={`flex flex-col gap-4 rounded-2xl border border-[#ded9ff] bg-[#f7f5ff] p-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex min-w-0 gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9e4ff] text-[#4b2df1]">
          <BellRing aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 id={titleId} className="text-xs font-bold text-[#0a154f]">
            {copy.pushTitle}
          </h2>
          <p
            id={descriptionId}
            aria-live="polite"
            className="mt-1 text-[11px] leading-5 text-[#59649a]"
          >
            {pushStatusMessage[webPushStatus]}
          </p>
        </div>
      </div>
      <button
        type="button"
        aria-describedby={descriptionId}
        aria-pressed={webPushStatus === 'subscribed'}
        aria-busy={pushBusy}
        disabled={pushBusy || pushUnavailable}
        onClick={() => {
          const operation =
            webPushStatus === 'subscribed' ? disablePush() : enablePush();
          void operation.catch(() => undefined);
        }}
        className="min-h-11 shrink-0 rounded-xl bg-[#4b2df1] px-4 py-2.5 text-[11px] font-bold text-white transition hover:bg-[#3f25db] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4b2df1]/25 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {webPushStatus === 'subscribed'
          ? copy.pushDisable
          : webPushStatus === 'disabling'
            ? copy.pushDisabling
            : webPushStatus === 'enabling'
              ? copy.pushEnabling
              : copy.pushEnable}
      </button>
    </section>
  );
}
