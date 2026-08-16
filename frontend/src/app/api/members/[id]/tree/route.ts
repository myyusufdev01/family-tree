import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, HttpError } from "@/lib/http";
import { getFamilyTree, MAX_DEPTH_DOWN, MAX_DEPTH_UP, MAX_TREE_NODES } from "@/lib/tree";

export const runtime = "nodejs";

/** GET /api/members/{id}/tree — pohon keluarga terfokus pada satu anggota. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getCurrentUser(req.headers.get("authorization"));
    const userId = Number(req.nextUrl.searchParams.get("user_id") ?? "0");
    const { id } = await params;

    const maxNodes = Number(
      req.nextUrl.searchParams.get("max_nodes") ?? String(MAX_TREE_NODES),
    );
    const depthUp = Number(
      req.nextUrl.searchParams.get("depth_up") ?? String(MAX_DEPTH_UP),
    );
    const depthDown = Number(
      req.nextUrl.searchParams.get("depth_down") ?? String(MAX_DEPTH_DOWN),
    );
    if (!Number.isFinite(maxNodes) || maxNodes < 10 || maxNodes > 200) {
      throw new HttpError(422, "max_nodes harus antara 10 dan 200");
    }
    if (!Number.isFinite(depthUp) || depthUp < 0 || depthUp > 5) {
      throw new HttpError(422, "depth_up harus antara 0 dan 5");
    }
    if (!Number.isFinite(depthDown) || depthDown < 0 || depthDown > 5) {
      throw new HttpError(422, "depth_down harus antara 0 dan 5");
    }

    const tree = await getFamilyTree(userId, id, {
      max_nodes: maxNodes,
      depth_up: depthUp,
      depth_down: depthDown,
    });
    return NextResponse.json(tree);
  } catch (err) {
    return errorResponse(err);
  }
}
