import { getSession } from "./auth.ts";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const session = await getSession();
  const apiBase =
    import.meta.env.PUBLIC_API_BASE_URL ||
    "https://xwwkpwzartndbjlzpttc.supabase.co/functions/v1/api/v1";

  const url = `${apiBase}${path.startsWith("/") ? path : "/" + path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...((init.headers as Record<string, string>) || {})
  };

  const res = await fetch(url, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body.error?.code || "UNKNOWN",
      body.error?.message || "Request failed",
      body.error?.requestId,
      body.error?.details
    );
  }

  return body.data as T;
}
