import { NextResponse } from "next/server";

/**
 * Error yang membawa kode HTTP — dilempar dari lapisan lib/route handler
 * lalu diubah menjadi `NextResponse` dengan bentuk `{ detail }` (sama seperti
 * `HTTPException` FastAPI di backend lama).
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
    this.name = "HttpError";
  }
}

/** Ubah error tak dikenal menjadi respons JSON dengan bentuk `{ detail }`. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ detail: err.detail }, { status: err.status });
  }
  console.error("[api] error tidak terduga:", err);
  return NextResponse.json(
    { detail: "Internal server error" },
    { status: 500 },
  );
}
