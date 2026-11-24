/**
 * The public origin of the site, used as `metadataBase` so share tags (og:image, og:url) carry absolute URLs.
 *
 * - `DOMAIN` (the host Caddy serves in production) wins: `https://<DOMAIN>`.
 * - Otherwise the request host: the first `x-forwarded-host`, else `host`, with the first `x-forwarded-proto`
 *   (http in development and https in production when absent).
 * - Undefined when neither is a valid host name, and Next falls back to its own default.
 *
 * Never throws.
 */
export interface SiteUrlInput {
  domain?: string;
  host?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  nodeEnv?: string;
}

// A DNS name or IPv4 address with an optional port. IPv6 literals are not accepted.
const HOST_PORT = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*(:\d{1,5})?$/;

/** First entry of a comma-separated header value, trimmed and lowercased. */
function first(value: string | null | undefined): string {
  return (value ?? '').split(',')[0].trim().toLowerCase();
}

/** The value as a host name, or '' when it is not one. */
function validHost(value: string | null | undefined): string {
  const v = first(value);
  return v.length <= 259 && HOST_PORT.test(v) ? v : '';
}

export function siteUrl({ domain, host, forwardedHost, forwardedProto, nodeEnv }: SiteUrlInput): URL | undefined {
  const configured = validHost(domain);
  if (configured) return new URL(`https://${configured}`);

  const requestHost = validHost(forwardedHost) || validHost(host);
  if (!requestHost) return undefined;
  const proto = first(forwardedProto);
  const scheme = proto === 'http' || proto === 'https' ? proto : nodeEnv === 'production' ? 'https' : 'http';
  return new URL(`${scheme}://${requestHost}`);
}
