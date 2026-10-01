import { prisma } from "@/lib/db";

/**
 * File storage backed by MongoDB (Atlas).
 *
 * WHY: serverless hosts (Vercel) run on a read-only filesystem —
 * `fs.writeFile` to the app directory fails in production, which broke
 * student document and profile photo uploads. Storing bytes in the
 * database keeps everything on the free tier with no external service,
 * persists across deploys, and works identically in local dev.
 *
 * LAYOUT: each upload becomes a StoredFile row; callers keep the id in
 * their own URL fields:
 *  - documents: `db:<id>` private path (served via the authenticated
 *    download endpoint only)
 *  - profile photos / brand assets: `/api/files/<id>` (served by the
 *    files route with a session check — enough for in-app <img> tags,
 *    which send same-origin cookies)
 *
 * MongoDB documents cap at 16MB; every upload path already enforces
 * ≤5MB, well within the limit.
 */
export const fileStorage = {
  /** Persist bytes, return the StoredFile id. */
  async put(input: {
    kind: string;
    bytes: Uint8Array;
    fileName: string;
    origName?: string;
    mimeType: string;
    ownerId?: string;
  }): Promise<string> {
    const row = await prisma.storedFile.create({
      data: {
        kind: input.kind,
        ownerId: input.ownerId ?? null,
        fileName: input.fileName,
        origName: input.origName ?? null,
        mimeType: input.mimeType,
        size: input.bytes.byteLength,
        data: Buffer.from(input.bytes),
        deletedAt: null, // ensure the soft-delete key is set (MongoDB schemaless quirk)
      },
      select: { id: true },
    });
    return row.id;
  },

  /** Fetch one file's bytes + metadata. Returns null when missing/soft-deleted. */
  async get(id: string) {
    const row = await prisma.storedFile.findFirst({
      where: { id, deletedAt: null },
      select: { kind: true, ownerId: true, fileName: true, origName: true, mimeType: true, size: true, data: true },
    });
    if (!row) return null;
    return {
      kind: row.kind,
      ownerId: row.ownerId,
      fileName: row.origName ?? row.fileName,
      mimeType: row.mimeType,
      size: row.size,
      bytes: new Uint8Array(row.data),
    };
  },

  /** Best-effort delete — never throws. */
  async remove(id: string) {
    try {
      await prisma.storedFile.delete({ where: { id } });
    } catch {
      // best-effort
    }
  },

  /** Extract the StoredFile id from a `db:<id>` private path. */
  parseDbPath(fileUrl: string): string | null {
    if (!fileUrl.startsWith("db:")) return null;
    const id = fileUrl.slice(3);
    return /^[a-f0-9]{24}$/i.test(id) ? id : null;
  },
};
