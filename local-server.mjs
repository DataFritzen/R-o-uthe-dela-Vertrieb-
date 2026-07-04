import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 8765);
const host = process.env.HOST || "127.0.0.1";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${host}:${port}`);

  if (url.pathname === "/api/check-website") {
    await handleWebsiteCheck(request, response);
    return;
  }

  if (url.pathname === "/api/overpass") {
    await handleOverpass(request, response);
    return;
  }

  const requested = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(root, requested === "/" ? "index.html" : requested);

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  if (statSync(filePath).isDirectory()) filePath = join(filePath, "index.html");

  response.writeHead(200, {
    "Content-Type": types[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`Vertriebsapp laeuft unter http://${host}:${port}`);
});

async function handleWebsiteCheck(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJson(request);
    const targetUrl = normalizeWebsiteUrl(body.url);
    if (!targetUrl) {
      sendJson(response, 400, { error: "Keine gueltige URL uebergeben." });
      return;
    }

    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const fetchResponse = await fetch(targetUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "VertriebsappWebsiteCheck/1.0",
        Accept: "text/html,application/xhtml+xml"
      }
    });
    clearTimeout(timeout);

    const finalUrl = fetchResponse.url || targetUrl;
    const html = await fetchResponse.text();
    const durationMs = Date.now() - started;
    sendJson(response, 200, analyzeWebsite({
      url: targetUrl,
      finalUrl,
      status: fetchResponse.status,
      durationMs,
      html
    }));
  } catch (error) {
    sendJson(response, 200, {
      ok: false,
      score: 0,
      summary: error.name === "AbortError" ? "Zeitlimit erreicht" : "Webseite konnte nicht geprueft werden",
      checks: [],
      error: error.message
    });
  }
}

async function handleOverpass(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJson(request);
    const query = String(body.query || "").trim();
    if (!query) {
      sendJson(response, 400, { error: "Keine Overpass-Abfrage uebergeben." });
      return;
    }
    const result = await fetchOverpass(query);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 502, {
      error: error.message || "Overpass ist gerade nicht erreichbar."
    });
  }
}

async function fetchOverpass(query) {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];
  let lastError;

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "VertriebsappOverpassProxy/1.0"
        },
        body: new URLSearchParams({ data: query })
      });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`${endpoint} HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message || "Overpass ist gerade nicht erreichbar.");
}

function analyzeWebsite({ url, finalUrl, status, durationMs, html }) {
  const text = stripHtml(html).toLowerCase();
  const title = matchContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = matchMeta(html, "description");
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasForm = /<form[\s>]/i.test(html);
  const hasHttps = finalUrl.startsWith("https://");
  const hasContact = /kontakt|contact|telefon|phone|termin|anfrage/.test(text);
  const hasLegal = /impressum|datenschutz|privacy/.test(text);
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(html);
  const hasPhone = /(\+49|0)[\s()/.-]*\d[\d\s()/.-]{6,}/.test(text);

  const checks = [
    check("HTTPS", hasHttps, 15),
    check("Erreichbar", status >= 200 && status < 400, 15, `HTTP ${status}`),
    check("Schnelle Antwort", durationMs < 2500, 12, `${durationMs} ms`),
    check("Seitentitel", title.length >= 8, 8),
    check("Beschreibung", description.length >= 40, 8),
    check("Mobil-Viewport", hasViewport, 10),
    check("Kontakt erkennbar", hasContact || hasEmail || hasPhone, 14),
    check("Impressum/Datenschutz", hasLegal, 8),
    check("Formular/Anfrage", hasForm, 10)
  ];

  const score = checks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0);
  const summary = score >= 80
    ? "Gute Webseite"
    : score >= 55
      ? "Brauchbare Webseite"
      : "Schwache Webseite";

  return {
    ok: true,
    url,
    finalUrl,
    status,
    durationMs,
    score,
    summary,
    title,
    description,
    checks
  };
}

function check(label, passed, points, detail = "") {
  return { label, passed, points, detail };
}

function normalizeWebsiteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function matchContent(html, regex) {
  const match = html.match(regex);
  return decodeHtml(match?.[1] || "").replace(/\s+/g, " ").trim();
}

function matchMeta(html, name) {
  const regex = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return matchContent(html, regex);
}

function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20000) {
        reject(new Error("Request zu gross."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}
