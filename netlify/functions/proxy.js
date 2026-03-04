// netlify/functions/proxy.js
// Proxy serverless: browser chama /api/llm (mesmo domínio, sem CORS),
// esta função repassa para qualquer API de LLM externamente.
// Funciona com Netlify quando deploy é feito via GitHub.

exports.handler = async (event) => {
  const CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  // GET /api/llm?base=URL&key=KEY → lista modelos do provedor
  if (event.httpMethod === "GET") {
    const p = event.queryStringParameters || {};
    if (!p.base) return { statusCode: 400, headers: CORS, body: "param 'base' required" };
    try {
      const resp = await fetch(p.base.replace(/\/+$/, "") + "/models", {
        headers: {
          "Content-Type": "application/json",
          ...(p.key ? { "Authorization": "Bearer " + p.key } : {})
        }
      });
      return {
        statusCode: resp.status,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: await resp.text()
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
        "Content-Type": "application/json",
        ...(apiKey ? { "Authorization": "Bearer " + apiKey } : {}),
        ...(extraHeaders || {}),
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
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
    console.error("proxy error:", e);
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
};
