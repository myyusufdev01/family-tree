import { getMember } from "./firestore";
import { HttpError } from "./http";
import type { FamilyTree, Member } from "./types";

/**
 * Pohon keluarga terfokus pada satu anggota (port dari endpoint
 * `/api/members/{id}/tree` di `backend/main.py`).
 *
 * Traversal BFS mengikuti generasi relatif terhadap anggota fokus
 * (root=0, orang tua=-1, kakek/nenek=-2, anak=+1, cucu=+2, dst.) dan
 * dibatasi oleh `max_nodes` + `depth_up`/`depth_down` supaya tetap
 * ringan walau total anggota mencapai ribuan.
 */

export const MAX_TREE_NODES = 80;
export const MAX_DEPTH_UP = 3;
export const MAX_DEPTH_DOWN = 3;

export interface TreeOptions {
  max_nodes?: number;
  depth_up?: number;
  depth_down?: number;
}

export async function getFamilyTree(
  userId: number,
  memberId: string,
  options: TreeOptions = {},
): Promise<FamilyTree> {
  const maxNodes = options.max_nodes ?? MAX_TREE_NODES;
  const depthUp = options.depth_up ?? MAX_DEPTH_UP;
  const depthDown = options.depth_down ?? MAX_DEPTH_DOWN;

  const member = await getMember(userId, memberId);
  if (!member) {
    throw new HttpError(404, "Member not found");
  }

  const byId = new Map<string, Member>([[member.id, member]]);
  const generations = new Map<string, number>([[member.id, 0]]);
  let truncated = false;
  const queue: string[] = [member.id];

  const tryAdd = async (rid: string, gen: number): Promise<void> => {
    if (byId.has(rid)) return;
    if (byId.size >= maxNodes) {
      truncated = true;
      return;
    }
    const rel = await getMember(userId, rid);
    if (!rel) return;
    byId.set(rid, rel);
    generations.set(rid, gen);
    queue.push(rid);
  };

  while (queue.length > 0) {
    if (byId.size >= maxNodes) {
      truncated = true;
      break;
    }
    const mid = queue.shift() as string;
    const m = byId.get(mid) as Member;
    const g = generations.get(mid) as number;

    const relSpec: Array<[keyof Member, number]> = [
      ["sibling_ids", 0],
      ["spouse_ids", 0],
    ];
    if (g - 1 >= -depthUp) relSpec.push(["parent_ids", -1]);
    if (g + 1 <= depthDown) relSpec.push(["child_ids", 1]);

    for (const [attr, delta] of relSpec) {
      for (const rid of (m[attr] as string[])) {
        await tryAdd(rid, g + delta);
        if (truncated) break;
      }
      if (truncated) break;
    }
  }

  const family: Record<string, Member> = {};
  for (const [mid, m] of byId) family[mid] = m;

  const genMap: Record<string, number> = {};
  for (const [mid, gen] of generations) genMap[String(mid)] = gen;

  return {
    member,
    family,
    generations: genMap,
    root_id: member.id,
    truncated,
    total_nodes: byId.size,
  };
}
