import type { MetadataRoute } from "next";
import { appUrl } from '@/lib/app-url';

export default function robots(): MetadataRoute.Robots {
  const base = appUrl();
  return {
    rules: {
      userAgent: "*",
      // A customer's card and the join page are public so they work from a QR,
      // not so they get indexed. The rest is behind a login anyway.
      disallow: ["/dashboard", "/pos", "/scan", "/c/", "/j/", "/api/"],
      allow: "/",
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
