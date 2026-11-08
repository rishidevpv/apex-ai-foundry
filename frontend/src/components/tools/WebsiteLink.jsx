import { ArrowUpRight, Globe } from 'lucide-react';

// Link to a tool's own website. Opens in a new tab; only plain http(s) links are ever shown.
const safe = (url) => { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; } };
const host = (u) => u.hostname.replace(/^www\./, '');

/**
 * variant="button" — full button (tool page)
 * variant="link"   — quiet text link under a card ("Visit website ↗")
 * variant="icon"   — compact link for dense lists
 */
export function WebsiteLink({ url, name, variant = 'link', className = '', testid }) {
  const u = safe(url);
  if (!u) return null;
  const common = { href: u.href, target: '_blank', rel: 'noopener noreferrer nofollow', 'data-testid': testid, onClick: (e) => e.stopPropagation(), title: `Open ${host(u)} in a new tab` };
  if (variant === 'button') {
    return <a {...common} className={`if-btn-ghost ${className}`} aria-label={`Visit the ${name || 'tool'} website (opens in a new tab)`}><Globe className="h-4 w-4" />Visit website<ArrowUpRight className="h-4 w-4" /></a>;
  }
  if (variant === 'icon') {
    return <a {...common} className={`inline-flex min-h-10 items-center gap-1 rounded-lg px-1 text-sm font-medium text-[var(--brand)] hover:underline ${className}`} aria-label={`Visit the ${name || 'tool'} website (opens in a new tab)`}>Website<ArrowUpRight className="h-3.5 w-3.5" /></a>;
  }
  return (
    <a {...common} className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[var(--ink-2)] hover:text-[var(--brand)] hover:underline ${className}`} aria-label={`Visit the ${name || 'tool'} website (opens in a new tab)`}>
      <Globe className="h-3.5 w-3.5" />Visit {host(u)}<ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  );
}
