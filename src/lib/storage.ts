import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { badRequest, notFound } from "@/lib/http";

/**
 * Storage boundary mirroring Supabase Storage buckets (audio, video, covers, avatars).
 * Files live in STORAGE_DIR (default ./storage) and are served by /api/media/[bucket]/[...path].
 * Swap the implementation for Supabase Storage / S3 without touching callers.
 */
export type Bucket = "audio" | "video" | "covers" | "avatars";

interface BucketPolicy {
  maxBytes: number;
  mimes: Record<string, string>; // mime -> extension
  public: boolean;
}

export const BUCKET_POLICIES: Record<Bucket, BucketPolicy> = {
  audio: {
    maxBytes: 40 * 1024 * 1024,
    mimes: { "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mp4": "m4a", "audio/aac": "aac", "audio/ogg": "ogg" },
    public: false,
  },
  video: {
    maxBytes: 120 * 1024 * 1024,
    mimes: { "video/mp4": "mp4", "video/webm": "webm" },
    public: false,
  },
  covers: {
    maxBytes: 8 * 1024 * 1024,
    mimes: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" },
    public: true,
  },
  avatars: {
    maxBytes: 3 * 1024 * 1024,
    mimes: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" },
    public: true,
  },
};

const root = () => process.env.STORAGE_DIR || path.join(process.cwd(), "storage");

export function validateUpload(bucket: Bucket, file: File): void {
  const policy = BUCKET_POLICIES[bucket];
  if (!file || file.size === 0) throw badRequest("File is empty");
  if (file.size > policy.maxBytes) {
    throw badRequest(`File exceeds the ${Math.round(policy.maxBytes / 1024 / 1024)} MB limit for ${bucket}`);
  }
  if (!policy.mimes[file.type]) {
    throw badRequest(`Unsupported file type "${file.type || "unknown"}" for ${bucket}`);
  }
}

/** Validates, stores and returns the public path used by the app (e.g. /api/media/covers/x.jpg). */
export async function saveUpload(bucket: Bucket, file: File): Promise<string> {
  validateUpload(bucket, file);
  const ext = BUCKET_POLICIES[bucket].mimes[file.type];
  const name = `${randomUUID()}.${ext}`;
  const dir = path.join(root(), bucket);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/api/media/${bucket}/${name}`;
}

const MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg",
  mp4: "video/mp4", webm: "video/webm", jpg: "image/jpeg", png: "image/png", webp: "image/webp",
};

/** Reads a stored object, guarding against path traversal. */
export async function readObject(bucket: Bucket, relPath: string): Promise<{ data: Buffer; size: number; type: string }> {
  if (!(bucket in BUCKET_POLICIES)) throw notFound();
  const safe = path.basename(relPath);
  if (safe !== relPath) throw notFound();
  const full = path.join(root(), bucket, safe);
  try {
    const info = await stat(full);
    const data = await readFile(full);
    return { data, size: info.size, type: MIME_BY_EXT[safe.split(".").pop() ?? ""] ?? "application/octet-stream" };
  } catch {
    throw notFound("Media file not found");
  }
}
