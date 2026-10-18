import type { ProviderInfo } from '@/lib/apiClient';
import type { LlmSource } from '@/lib/store';

/** `ok`: configured and the last call (if any) used the model. `degraded`: configured, but the last call fell back. `off`: no key. */
export type ProviderTone = 'ok' | 'degraded' | 'off' | 'unknown';
export interface ProviderStatus { tone: ProviderTone; label: string; note?: string }

/** The Settings "Provider" row: the configured provider's label, with a tone for its status dot. */
export function providerStatus(provider: ProviderInfo | null, lastSource: LlmSource): ProviderStatus {
  if (!provider) return { tone: 'unknown', label: '—' };
  if (!provider.configured) return { tone: 'off', label: provider.label };
  if (lastSource === 'fallback') return { tone: 'degraded', label: provider.label, note: 'last call used the offline fallback' };
  return { tone: 'ok', label: provider.label };
}
