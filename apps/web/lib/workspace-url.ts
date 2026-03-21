/**
 * Navigate to a workspace.
 *
 * Production (NEXT_PUBLIC_ROOT_DOMAIN set to e.g. "ping.app"):
 *   → redirects to subdomain: slug.ping.app/inbox
 *
 * Development (localhost):
 *   → uses path-based routing: localhost:3000/app/slug/inbox
 *   (subdomains don't work on localhost in Chrome)
 */
export function navigateToWorkspace(slug: string, path = "/inbox") {
  if (typeof window === "undefined") return;

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const rootHost = rootDomain.split(":")[0];

  // Localhost — use path-based routing
  if (rootHost === "localhost") {
    window.location.href = `/app/${slug}${path}`;
    return;
  }

  // Already on this workspace's subdomain
  const currentHost = window.location.hostname;
  if (currentHost.startsWith(`${slug}.`)) {
    window.location.href = path;
    return;
  }

  // Production — use subdomain
  const port = rootDomain.split(":")[1];
  const portSuffix = port ? `:${port}` : "";
  const host = `${slug}.${rootHost}${portSuffix}`;
  window.location.href = `https://${host}${path}`;
}
