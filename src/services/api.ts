/** Typed client-side fetch helper. Normalises server errors into ApiError for consistent UI messages. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export type ApiInit = RequestInit & { json?: unknown };

export async function api<T = unknown>(url: string, init: ApiInit = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const h = new Headers(headers);
  let body = rest.body;
  if (json !== undefined) {
    h.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }
  let res: Response;
  try {
    res = await fetch(url, { ...rest, body, headers: h, credentials: "same-origin" });
  } catch {
    throw new ApiError("You appear to be offline. Check your connection and try again.", 0, "offline");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.code);
  return data as T;
}

/** Upload with real progress events (XMLHttpRequest exposes upload progress; fetch does not). */
export function uploadWithProgress<T = unknown>(
  url: string,
  form: FormData,
  onProgress: (fraction: number) => void,
  method: "POST" | "PATCH" = "POST",
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data: { error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve(data as T);
      } else reject(new ApiError(data.error ?? `Upload failed (${xhr.status})`, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Network error during upload", 0, "offline"));
    xhr.send(form);
  });
}
