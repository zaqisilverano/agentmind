'use client';

import { providerStatus, type ProviderTone } from '@/lib/providerStatus';
import { useStore } from '@/lib/store';

const DOT: Record<ProviderTone, string> = {
  ok: '#22A05A',
  degraded: '#E0A100',
  off: 'var(--faint)',
  unknown: 'transparent',
};

/** Right-hand side of the Settings "Provider" row (desktop menu and mobile sheet): status dot, label, optional note. */
export function ProviderStatus() {
  const provider = useStore(s => s.provider);
  const lastSource = useStore(s => s.lastSource);
  const { tone, label, note } = providerStatus(provider, lastSource);
  return (
    <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5 text-right" data-testid="provider-status" data-tone={tone}>
      <div className="flex min-w-0 max-w-full items-center gap-1.5 text-[11px]" title={note ? `${label} · ${note}` : label}>
        {tone !== 'unknown' && <span aria-hidden="true" className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: DOT[tone] }} />}
        <span className="min-w-0 truncate">{label}</span>
      </div>
      {note && <div className="text-[10px] leading-tight text-muted">{note}</div>}
    </div>
  );
}
