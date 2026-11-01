import type { MetadataRoute } from "next";
import { getMovies } from "@/lib/data";
import { EDITORIAL_LISTS } from "@/lib/curation";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4317";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = ["", "/explore", "/recommend", "/favorites", "/sources"].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const movieRoutes = getMovies().map((m) => ({
    url: `${BASE}/movies/${m.slug}`,
    lastModified: new Date(m.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const curatedRoutes = EDITORIAL_LISTS.map((l) => ({
    url: `${BASE}/curated/${l.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...curatedRoutes, ...movieRoutes];
}
