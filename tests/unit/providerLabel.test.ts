import { describe, expect, it } from 'vitest';
import { providerLabel } from '@/lib/llm/providerLabel';

describe('providerLabel', () => {
  it('is "Offline fallback" when no key is configured, whatever the model', () => {
    expect(providerLabel('IFM/K2-Horizon-375B-A23B', false)).toBe('Offline fallback');
    expect(providerLabel('llama3.1:8b', false)).toBe('Offline fallback');
  });
  it('names K2 Horizon with its size when present', () => {
    expect(providerLabel('IFM/K2-Horizon-375B-A23B', true)).toBe('K2 Horizon 375B');
    expect(providerLabel('IFM/K2-Horizon-7B', true)).toBe('K2 Horizon 7B');
    expect(providerLabel('ifm/k2-horizon-375b-a23b', true)).toBe('K2 Horizon 375B');
    expect(providerLabel('IFM/K2-Horizon', true)).toBe('K2 Horizon');
  });
  it('otherwise uses the model id after the last "/"', () => {
    expect(providerLabel('llama3.1:8b', true)).toBe('llama3.1:8b');
    expect(providerLabel('ollama/library/qwen2.5:14b', true)).toBe('qwen2.5:14b');
    expect(providerLabel('openai/gpt-oss-120b', true)).toBe('gpt-oss-120b');
  });
  it('falls back to the whole id when nothing follows the last "/"', () => {
    expect(providerLabel('weird/', true)).toBe('weird/');
  });
});
