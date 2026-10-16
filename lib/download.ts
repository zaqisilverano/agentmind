/** Filename-safe slug of a brain title, as in the prototype. Falls back to "idea". */
export const slugify = (title: string): string =>
  (title || 'idea').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'idea';

/** Saves `text` as a file through a temporary Blob URL. Browser only. */
export function download(filename: string, text: string, mime: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
