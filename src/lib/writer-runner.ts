import { db } from "@/lib/db";
import { llmJson, generateImage } from "@/lib/ai";
import { getSetting } from "@/lib/settings";
import { WRITER_PROMPT_DEFAULT, AFFILIATE_PROMPT_DEFAULT } from "@/lib/prompts";
import fs from "fs";
import path from "path";

export interface WriterInput {
  keyword: string;
  mode: "STANDARD" | "PREMIUM";
  words: number; // target word count
  imageStyle: "vector" | "photo" | "brutalist" | "diagram";
  internalLinks: { url: string; anchor: string }[];
  affiliateLinks: { label: string; url: string }[];
  siteName?: string;
  notes?: string;
  audience?: string;
}

export interface WriterResult {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  focusKeyword: string;
  wordCount: number;
  contentHtml: string;
  faqs: { q: string; a: string }[];
}

const STYLE_SUFFIX: Record<string, string> = {
  vector: "flat vector illustration, minimal geometric shapes, solid colors, soft sage green and warm sand palette, pure white background, clean thin outlines, no text, no letters, no watermark",
  photo: "professional photograph, natural lighting, sharp focus, realistic, high detail, no text overlay, no watermark",
  brutalist: "neo-brutalist style illustration, bold flat colors, thick black outlines, simple geometric shapes, off-white background, no gradients, no text, no watermark",
  diagram: "clean technical infographic diagram, minimal flat style, soft sage green and charcoal palette, white background, simple shapes, minimal labels, no watermark",
};

function parseLinks(raw: string): { url: string; anchor: string }[] {
  return raw.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 10).map((line) => {
    const parts = line.split("|").map((p) => p.trim());
    return { url: parts[0], anchor: parts[1] || "" };
  }).filter((l) => /^https?:\/\/.+\..+/.test(l.url));
}

/** Background pipeline for a ContentJob. */
export async function runWriter(jobId: string): Promise<void> {
  const job = await db.contentJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "PENDING") return;

  const { addCredits } = await import("@/lib/credits");
  try {
    await db.contentJob.update({ where: { id: jobId }, data: { status: "RUNNING" } });
    const input = JSON.parse(job.input || "{}") as Partial<WriterInput>;
    const keyword = (input.keyword || job.keyword || "").trim();
    const words = Math.max(800, Math.min(4000, Number(input.words) || 2500));
    const style = STYLE_SUFFIX[input.imageStyle || "vector"];

    const prompts = await getSetting("prompts", { audit: "", writer: WRITER_PROMPT_DEFAULT, affiliate: AFFILIATE_PROMPT_DEFAULT });
    const master = job.type === "AFFILIATE" ? (prompts.affiliate || AFFILIATE_PROMPT_DEFAULT) : (prompts.writer || WRITER_PROMPT_DEFAULT);

    const system = `${master}

LENGTH: aim for ${words} words (about ${Math.round(words / 300)} substantial sections).
IMAGE STYLE for imageBriefs prompts: ${style}`;
    const parts = [`Keyword: ${keyword}`];
    if (input.audience) parts.push(`Target reader: ${input.audience}`);
    if (input.internalLinks?.length) {
      parts.push(`Internal links to weave in naturally (use these URLs and anchors):\n${input.internalLinks.map((l) => `- ${l.url} (anchor: ${l.anchor || "natural"})`).join("\n")}`);
    }
    if (job.type === "AFFILIATE") {
      if (input.affiliateLinks?.length) {
        parts.push(`Affiliate links to recommend (use ONLY these, with descriptive anchors):\n${input.affiliateLinks.map((l) => `- ${l.label}: ${l.url}`).join("\n")}`);
      } else {
        parts.push("No affiliate links provided: write a general buying guide and note where the reader should compare options, but do not invent product URLs.");
      }
    }
    if (input.siteName) parts.push(`The article will be published on: ${input.siteName}`);
    if (input.notes) parts.push(`Extra instructions from the publisher: ${input.notes.slice(0, 500)}`);

    const { data } = await llmJson<WriterResult>({
      system,
      user: parts.join("\n\n"),
      mode: job.mode === "PREMIUM" ? "premium" : "standard",
      writer: true,
      maxTokens: job.mode === "PREMIUM" ? 16000 : 10000,
      temperature: 0.55,
    });

    // Clean content HTML: allowlist tags, drop fences
    let html = String(data.contentHtml || "").replace(/^```html\s*/i, "").replace(/```\s*$/i, "").trim();
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/on\w+="[^"]*"/gi, "");

    const result: WriterResult = {
      title: String(data.title || keyword).slice(0, 200),
      slug: String(data.slug || keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)),
      metaTitle: String(data.metaTitle || data.title || keyword).slice(0, 70),
      metaDescription: String(data.metaDescription || "").slice(0, 160),
      excerpt: String(data.excerpt || "").slice(0, 300),
      focusKeyword: String(data.focusKeyword || keyword).slice(0, 100),
      wordCount: Number(data.wordCount) || html.split(/\s+/).length,
      contentHtml: html,
      faqs: Array.isArray(data.faqs) ? data.faqs.slice(0, 12).map((f) => ({ q: String(f.q).slice(0, 300), a: String(f.a).slice(0, 1200) })) : [],
    };

    // Images: generate up to 3, saved to /public/generated/<jobId>/
    const images: { file: string; title: string; alt: string }[] = [];
    const briefs = Array.isArray(data.imageBriefs) ? data.imageBriefs.slice(0, 3) : [];
    if (briefs.length) {
      const dir = path.join(process.cwd(), "public", "generated", jobId);
      fs.mkdirSync(dir, { recursive: true });
      for (let i = 0; i < briefs.length; i++) {
        try {
          const buf = await generateImage(`${briefs[i].prompt}, ${style}`, i === 0 ? "1344x768" : "1344x768");
          const file = `generated/${jobId}/img-${i + 1}.png`;
          fs.writeFileSync(path.join(process.cwd(), "public", file), buf);
          images.push({ file: `/${file}`, title: String(briefs[i].title || `${keyword} image ${i + 1}`).slice(0, 120), alt: String(briefs[i].alt || "").slice(0, 200) });
        } catch (e) {
          console.error("image gen failed", jobId, i, e instanceof Error ? e.message : e);
        }
      }
    }

    // Replace markers with actual images
    let finalHtml = result.contentHtml;
    images.forEach((img, idx) => {
      const marker = new RegExp(`\\{\\{\\s*IMAGE_${idx + 1}\\s*\\}\\}`, "g");
      finalHtml = finalHtml.replace(marker, `<img src="${img.file}" alt="${img.alt.replace(/"/g, "&quot;")}" />`);
    });
    // Drop any unreplaced markers
    finalHtml = finalHtml.replace(/\{\{\s*IMAGE_\d\s*\}\}/g, "");
    result.contentHtml = finalHtml;

    await db.contentJob.update({
      where: { id: jobId },
      data: { status: "DONE", result: JSON.stringify(result), images: JSON.stringify(images) },
    });
  } catch (e) {
    await addCredits(job.userId, job.creditsUsed).catch(() => {});
    await db.contentJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: (e instanceof Error ? e.message : "Generation failed. Credits were refunded.").slice(0, 500) },
    }).catch(() => {});
  }
}

export { parseLinks };
