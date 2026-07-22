// Vercel serverless function: /api/pdf-proxy?url=<encoded url>
//
// Why this exists: browsers block a page's JS from fetching another site's
// PDF unless that site opts in with CORS headers — most don't. This function
// fetches server-side (no CORS restrictions apply there) and re-serves the
// bytes with permissive headers so the frontend can load them into pdf.js.
//
// It also handles the case where the pasted link is a normal webpage that
// merely *contains* a PDF link, by scanning the HTML for the first obvious
// .pdf href and fetching that instead.
//
// Deploy target: Vercel (drop this file in /api and it just works). For
// Netlify or Cloudflare Pages, port the handler signature accordingly —
// the fetching/parsing logic below is platform-agnostic.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();

  const targetUrl = req.query?.url;
  if (!targetUrl || !isHttpUrl(targetUrl)) {
    return res.status(400).json({ error: "Missing or invalid 'url' parameter." });
  }

  try {
    const pdfBuffer = await resolveToPdfBuffer(targetUrl);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(Buffer.from(pdfBuffer));
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || "Failed to fetch PDF." });
  }
}

function isHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchWithUA(url) {
  return fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; LeafletPdfProxy/1.0; +https://example.com)"
    },
    redirect: "follow"
  });
}

async function resolveToPdfBuffer(targetUrl, depth = 0) {
  if (depth > 1) {
    const err = new Error("Could not locate a PDF at that link.");
    err.status = 404;
    throw err;
  }

  const response = await fetchWithUA(targetUrl);
  if (!response.ok) {
    const err = new Error(`The link returned an error (HTTP ${response.status}).`);
    err.status = 502;
    throw err;
  }

  const contentType = response.headers.get("content-type") || "";
  const buffer = await response.arrayBuffer();

  if (contentType.includes("application/pdf") || looksLikePdf(buffer)) {
    return buffer;
  }

  if (contentType.includes("text/html")) {
    const html = new TextDecoder().decode(buffer);
    const pdfLink = findFirstPdfLink(html, targetUrl);
    if (pdfLink) {
      return resolveToPdfBuffer(pdfLink, depth + 1);
    }
  }

  const err = new Error(
    "That link doesn't point to a PDF, and no PDF link was found on the page."
  );
  err.status = 415;
  throw err;
}

function looksLikePdf(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer.slice(0, 5));
  const header = String.fromCharCode(...bytes);
  return header === "%PDF-";
}

function findFirstPdfLink(html, baseUrl) {
  const hrefRegex = /href=["']([^"']+\.pdf(?:[?#][^"']*)?)["']/gi;
  const match = hrefRegex.exec(html);
  if (!match) return null;
  try {
    return new URL(match[1], baseUrl).toString();
  } catch {
    return null;
  }
}
