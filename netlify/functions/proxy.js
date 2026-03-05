// Proxy serverless — contorna CORS e Cloudflare dos provedores
exports.handler = async (event) => {
  const CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  // Headers que imitam um browser real (contorna Cloudflare bot protection)
  const BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/event-stream, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };

  // GET ?base=URL&key=KEY → lista modelos
  if (event.httpMethod === "GET") {
    const p = event.queryStringParameters || {};
    if (!p.base) return { statusCode: 400, headers: CORS, body: "param 'base' required" };
    try {
      const resp = await fetch(p.base.replace(/\/+$/, "") + "/models", {
        headers: {
          ...BROWSER_HEADERS,
          "Content-Type": "application/json",
          ...(p.key ? { "Authorization": "Bearer " + p.key } : {})
        }
      });
      const text = await resp.text();
      return {
        statusCode: resp.status,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: text
      };
    } catch (e) {
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: e.message }) };
    }
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: "JSON inválido" }; }

  const { targetUrl, apiKey, payload, extraHeaders } = body;
  if (!targetUrl || !payload) {
    return { statusCode: 400, headers: CORS, body: "targetUrl e payload obrigatórios" };
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        "Content-Type": "application/json",
        ...(apiKey ? { "Authorization": "Bearer " + apiKey } : {}),
        ...(extraHeaders || {}),
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();

    // Detecta página de challenge do Cloudflare
    if (text.includes("Just a moment") || text.includes("cf-browser-verification")) {
      return {
        statusCode: 403,
        headers: CORS,
        body: JSON.stringify({ error: "O provedor bloqueou a requisição (Cloudflare). Tente outro provedor." })
      };
    }

    return {
      statusCode: upstream.status,
      headers: {
        ...CORS,
        "Content-Type": payload.stream
          ? "text/event-stream; charset=utf-8"
          : (upstream.headers.get("content-type") || "application/json"),
      },
      body: text,
    };
  } catch (e) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
};
