/**
 * Display name for the configured LLM, for the Settings "Provider" row and the status line. Pure (no react, next or
 * db), so the server (`/api/me`) and the client derive the same label. It only reads the model id: never the key or
 * the base URL.
 *
 * - not configured (no `LLM_API_KEY`): "Offline fallback"
 * - a K2 Horizon id: "K2 Horizon" plus its size when present ("IFM/K2-Horizon-375B-A23B" → "K2 Horizon 375B")
 * - anything else: the id after the last "/" ("library/llama3.1:8b" → "llama3.1:8b")
 */
export function providerLabel(model: string, configured: boolean): string {
  if (!configured) return 'Offline fallback';
  const k2 = /K2-Horizon(?:-(\d+(?:\.\d+)?[BMT])\b)?/i.exec(model);
  if (k2) return k2[1] ? `K2 Horizon ${k2[1].toUpperCase()}` : 'K2 Horizon';
  const tail = model.slice(model.lastIndexOf('/') + 1).trim();
  return tail || model.trim() || 'Model';
}
