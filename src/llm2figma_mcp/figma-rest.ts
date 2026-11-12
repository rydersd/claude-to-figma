// Shared Figma REST client for the server's REST tools (library, comments).
// Token and error discipline: the token goes in one header only, requests time
// out, and every failure is a fixed message plus the status code. Response
// bodies and runtime error text are never echoed, since either can quote the
// request (including the token header).

export const FIGMA_API_BASE = "https://api.figma.com";
export const FIGMA_TIMEOUT_MS = 15_000;

// /v1/ followed by plain segments and an optional simple query. Rejects "..",
// percent-encoding and anything else that could steer the token to another endpoint.
const SAFE_PATH = /^\/v1(?:\/[A-Za-z0-9_-]+)+(?:\?[A-Za-z0-9_=&-]*)?$/;

/** Per-tool hints for the statuses whose cause depends on the caller. */
export interface FigmaErrorHints {
  auth: string;
  notFound: string;
}

export interface FigmaRequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  hints: FigmaErrorHints;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export class FigmaApiError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
  }
}

// Retry-After is a number of seconds or an HTTP date; anything else is dropped.
function retryAfter(response: Response): string {
  const value = response.headers.get("retry-after") ?? "";
  return /^[A-Za-z0-9 ,:+-]{1,40}$/.test(value) ? value : "a moment";
}

export async function figmaRequest(path: string, token: string, opts: FigmaRequestOptions): Promise<any> {
  if (!SAFE_PATH.test(path)) {
    throw new FigmaApiError("Refused to call the Figma API: the request path is not a plain /v1/ path.", null);
  }
  const timeoutMs = opts.timeoutMs ?? FIGMA_TIMEOUT_MS;
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { "X-Figma-Token": token };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    // Looked up per call, so tests can replace globalThis.fetch.
    response = await (opts.fetchFn ?? globalThis.fetch)(`${FIGMA_API_BASE}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal,
      // Never follow a redirect: the token header would go to wherever it points.
      redirect: "error",
    });
  } catch (error: any) {
    // Fixed text only: a runtime error for a bad header quotes the header value.
    const why = error?.name === "TimeoutError" ? `timed out after ${timeoutMs / 1000}s` : "could not reach api.figma.com";
    throw new FigmaApiError(`Figma API request for ${path} failed: ${why}`, null);
  }
  if (!response.ok) {
    const status = response.status;
    const hint =
      status === 401 || status === 403
        ? opts.hints.auth
        : status === 404
          ? opts.hints.notFound
          : status === 429
            ? `rate limited — retry after ${retryAfter(response)}`
            : status === 400
              ? "Figma rejected the request"
              : "unexpected Figma API error";
    throw new FigmaApiError(`Figma API ${status} on ${path}: ${hint}`, status);
  }
  try {
    return await response.json();
  } catch {
    // A parse error can quote the body. The timeout also covers reading the body.
    const why = signal.aborted ? `timed out after ${timeoutMs / 1000}s` : "the response was not valid JSON";
    throw new FigmaApiError(`Figma API ${response.status} on ${path}: ${why}`, response.status);
  }
}
