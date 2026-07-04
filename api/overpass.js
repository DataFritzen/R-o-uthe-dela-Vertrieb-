module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await getRequestBody(request);
    const query = String(body.query || "").trim();
    if (!query) {
      sendJson(response, 400, { error: "Keine Overpass-Abfrage uebergeben." });
      return;
    }
    const result = await fetchOverpass(query);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 502, {
      error: error.message || "OpenStreetMap-Lead-Suche ist gerade nicht erreichbar."
    });
  }
};

async function fetchOverpass(query) {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];
  let lastError;

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18000);
      const overpassResponse = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "VertriebsappOverpassProxy/1.0"
        },
        body: new URLSearchParams({ data: query })
      });
      clearTimeout(timeout);
      if (!overpassResponse.ok) throw new Error(`${endpoint} HTTP ${overpassResponse.status}`);
      return await overpassResponse.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message || "Overpass ist gerade nicht erreichbar.");
}

async function getRequestBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");

  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 150000) {
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
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}
