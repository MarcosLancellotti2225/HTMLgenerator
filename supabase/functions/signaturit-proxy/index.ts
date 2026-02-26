import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SIGNATURIT_URLS: Record<string, string> = {
  sandbox: "https://api.sandbox.signaturit.com/v3",
  production: "https://api.signaturit.com/v3",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Signaturit-Environment",
};

serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Determinar entorno (sandbox por defecto)
    const env = req.headers.get("X-Signaturit-Environment") || "sandbox";
    const baseUrl = SIGNATURIT_URLS[env] || SIGNATURIT_URLS.sandbox;

    // Extraer el path después de /signaturit-proxy
    const url = new URL(req.url);
    const proxyPath = url.pathname.replace(/^\/signaturit-proxy/, "");
    const targetUrl = baseUrl + proxyPath + url.search;

    // Preparar headers para Signaturit
    const headers: Record<string, string> = {
      Authorization: authHeader,
    };

    // Leer body si no es GET
    let body: string | null = null;
    if (req.method !== "GET") {
      body = await req.text();
      // Mantener el Content-Type original
      const contentType = req.headers.get("Content-Type");
      if (contentType) {
        headers["Content-Type"] = contentType;
      }
    }

    // Proxy request a Signaturit
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const responseBody = await response.text();

    return new Response(responseBody, {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Proxy error: " + (error as Error).message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
