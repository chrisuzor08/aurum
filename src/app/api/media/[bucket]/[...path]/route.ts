import { BUCKET_POLICIES, readObject, type Bucket } from "@/lib/storage";
import { getCurrentUser, requireApiUser } from "@/lib/auth";
import { forbidden, notFound, withErrors } from "@/lib/http";

type Ctx = { params: Promise<{ bucket: string; path: string[] }> };

/**
 * Serves uploaded files from the storage boundary with HTTP Range support (required for seeking).
 *  - covers, avatars: public.
 *  - audio: signed-in users only.
 *  - video: signed-in users; full-song video additionally requires Premium (enforced in /api/stream).
 */
export const GET = withErrors<Ctx>(async (req, { params }) => {
  const { bucket, path } = await params;
  if (!(bucket in BUCKET_POLICIES)) throw notFound();
  const b = bucket as Bucket;
  if (b === "audio") await requireApiUser();
  if (b === "video") {
    const user = await getCurrentUser();
    if (!user) throw forbidden("Sign in to watch");
  }
  const { data, size, type } = await readObject(b, path.join("/"));
  const common = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": b === "covers" || b === "avatars" ? "public, max-age=86400" : "private, max-age=3600",
  };
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m && (m[1] || m[2])) {
      let start: number;
      let end: number;
      if (m[1]) {
        start = Number(m[1]);
        end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      } else {
        start = Math.max(0, size - Number(m[2]));
        end = size - 1;
      }
      if (start <= end && start < size) {
        return new Response(new Uint8Array(data.subarray(start, end + 1)), {
          status: 206,
          headers: { ...common, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
        });
      }
    }
  }
  return new Response(new Uint8Array(data), { headers: { ...common, "Content-Length": String(size) } });
});
