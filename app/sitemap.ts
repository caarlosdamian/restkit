import type { MetadataRoute } from "next";
import { VERTICALS } from "@/lib/verticals";
import { appUrl } from '@/lib/app-url';

/**
 * Only pages meant to be found. Everything customer- or staff-scoped is left
 * out on purpose: /c/[token] and /j/[slug] are reachable by design but nothing
 * about them belongs in an index, and the rest is behind a login.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/lealtad`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    ...VERTICALS.map((v) => ({
      url: `${base}/lealtad/${v.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
