/** An error with an HTTP status that `guard` (lib/api.ts) turns into a JSON error response, plus optional headers. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
