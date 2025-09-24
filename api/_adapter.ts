export function absoluteUrlFromNodeReq(req: any): string {
  const proto = (req.headers?.["x-forwarded-proto"] as string) || "https";
  const host = (req.headers?.["x-forwarded-host"] as string) || (req.headers?.host as string) || "localhost";
  const url = req.url || "/";
  return `${proto}://${host}${url}`;
}

export function toWebRequest(req: any): Request {
  const url = absoluteUrlFromNodeReq(req);
  const method = (req.method as string) || "GET";
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers ?? {})) {
    if (typeof v === "string") headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(", "));
  }
  let body: BodyInit | null = null;
  if (method !== "GET" && method !== "HEAD") {
    const raw = (req as any).body;
    if (raw == null) body = null;
    else if (typeof raw === "string" || raw instanceof ArrayBuffer || raw instanceof Uint8Array) body = raw as any;
    else body = JSON.stringify(raw);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  }
  return new Request(url, { method, headers, body });
}

export async function sendWebResponse(res: any, webResp: Response): Promise<void> {
  const headersObj: Record<string, string> = {};
  webResp.headers.forEach((value, key) => { headersObj[key] = value; });
  const text = await webResp.text();
  res.status(webResp.status).set(headersObj).send(text);
}


