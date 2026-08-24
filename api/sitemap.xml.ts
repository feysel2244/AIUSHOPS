import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {

  const base = "https://aiumarket.com";

  const staticPages = [
    "",
    "/browse",
    "/about",
    "/how-it-works",
    "/resources",
    "/contact",
    "/terms",
    "/privacy",
  ];

  const { data: products } = await supabase
    .from("products")
    .select("slug");

  const { data: services } = await supabase
    .from("services")
    .select("slug");

  const { data: shops } = await supabase
    .from("shops")
    .select("slug")
    .eq("status", "approved")
    .is("deleted_at", null);


  const urls = [
    ...staticPages.map(
      (page) => `${base}${page}`
    ),

    ...(products ?? []).map(
      (p) => `${base}/product/${p.slug}`
    ),

    ...(services ?? []).map(
      (s) => `${base}/service/${s.slug}`
    ),

    ...(shops ?? []).map(
      (s) => `${base}/shop/${s.slug}`
    ),
  ];


  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${urls.map(url => `
<url>
<loc>${url}</loc>
<changefreq>daily</changefreq>
<priority>0.8</priority>
</url>
`).join("")}

</urlset>`;


  res.setHeader(
    "Content-Type",
    "application/xml"
  );

  res.status(200).send(xml);
}