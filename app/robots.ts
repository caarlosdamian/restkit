import type { MetadataRoute } from "next";
import { appUrl } from '@/lib/app-url';

export default function robots(): MetadataRoute.Robots {
  const base = appUrl();
  return {
    rules: {
      userAgent: "*",
      // A customer's card and the join page are public so they work from a QR,
      // not so they get indexed. The rest is behind a login anyway.
      // /restablecer carries a live reset token in its query string. Fetching
      // it consumes nothing (only the POST does), but a URL that reaches an
      // index, a referrer header or a crawl log is a token that outlived the
      // inbox it was sent to. Neither page has anything to rank for anyway.
      disallow: ["/dashboard", "/pos", "/scan", "/c/", "/j/", "/api/", "/recuperar", "/restablecer"],
      allow: "/",
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
