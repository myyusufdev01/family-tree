"use client";

import Link from "next/link";
import { Target } from "lucide-react";
import type { FamilyTree, Member } from "@/lib/types";
import { GENDER_ICONS } from "@/lib/labels";
import { cn } from "@/lib/utils";

// ── Konstanta layout ─────────────────────────────────────────────────────────
const CARD_W = 168;
const CARD_H = 92;
const GAP_X = 12; // jarak horizontal antar kartu
const CONN_H = 36; // ruang vertikal untuk garis penghubung antar generasi
const ROW_H = CARD_H + CONN_H;
const PAD = 24;

const GEN_LABELS: Record<number, string> = {
  [-3]: "Buyut",
  [-2]: "Kakek/Nenek",
  [-1]: "Orang Tua",
  [0]: "Generasi Fokus",
  [1]: "Anak",
  [2]: "Cucu",
  [3]: "Cicit",
};

function genLabel(g: number): string {
  return GEN_LABELS[g] ?? `Generasi ${g > 0 ? "+" : ""}${g}`;
}

interface PlacedNode {
  id: string;
  cx: number; // titik tengah horizontal kartu
  top: number; // y bagian atas kartu
}

type EdgeKind = "parent_child" | "spouse" | "sibling";

interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
}

interface TreeLayout {
  placed: Map<string, PlacedNode>;
  edges: Edge[];
  levelMeta: { gen: number; label: string; count: number }[];
  totalW: number;
  totalH: number;
}

/**
 * Susun pohon ke baris-baris generasi dan hitung posisi kartu.
 * - Orang tua diletakkan di atas anaknya (garis penghubung).
 * - Saudara/pasangan dikelompokkan berdekatan.
 * - Baris generasi dirata-tengahkan agar pohon terlihat seimbang.
 */
function layoutTree(tree: FamilyTree): TreeLayout {
  const { family, generations = {} } = tree;
  const members = Object.values(family);

  const levelMap = new Map<number, string[]>();
  for (const m of members) {
    const g = generations[m.id] ?? 0;
    if (!levelMap.has(g)) levelMap.set(g, []);
    levelMap.get(g)!.push(m.id);
  }
  const gens = [...levelMap.keys()].sort((a, b) => a - b);
  if (gens.length === 0) gens.push(0);

  const colMap = new Map<string, number>();
  const orderedLevels = new Map<number, string[]>();

  for (const g of gens) {
    let ids = [...(levelMap.get(g) ?? [])];

    if (g !== gens[0]) {
      // Urutkan berdasarkan posisi relasi pada baris di sebelahnya:
      //  - generasi leluhur (negatif): acuan = anak-anaknya (baris bawah, sudah diurutkan)
      //  - generasi lainnya: acuan = orang tua-nya (baris atas, sudah diurutkan)
      const anchorLevel =
        g < 0 ? (orderedLevels.get(g + 1) ?? []) : (orderedLevels.get(g - 1) ?? []);
      const anchorCol = new Map<string, number>();
      anchorLevel.forEach((aid) => anchorCol.set(aid, colMap.get(aid)!));

      const scored: { id: string; key: number; tie: number }[] = [];
      const noScore: string[] = [];
      ids.forEach((id, i) => {
        const m = family[id];
        const refIds =
          g < 0
            ? anchorLevel.filter((cid) => (family[cid].parent_ids ?? []).includes(id))
            : (m.parent_ids ?? []).filter((p) => anchorCol.has(p));
        const cols = refIds.map((r) => anchorCol.get(r)!);
        if (cols.length > 0) {
          scored.push({ id, key: cols.reduce((a, b) => a + b, 0) / cols.length, tie: i });
        } else {
          noScore.push(id);
        }
      });
      scored.sort((a, b) => a.key - b.key || a.tie - b.tie);
      const ordered = scored.map((s) => s.id);
      // Anggota tanpa acuan (mis. pasangan) diselipkan di samping pasangannya.
      for (const id of noScore) {
        const m = family[id];
        let placed = false;
        for (const sid of m.spouse_ids ?? []) {
          const idx = ordered.indexOf(sid);
          if (idx !== -1) {
            ordered.splice(idx + 1, 0, id);
            placed = true;
            break;
          }
        }
        if (!placed) ordered.push(id);
      }
      ids = ordered;
    }

    orderedLevels.set(g, ids);
    ids.forEach((id, col) => colMap.set(id, col));
  }

  const colW = CARD_W + GAP_X;
  const maxLevelLen = Math.max(...[...orderedLevels.values()].map((l) => l.length), 1);
  const maxWidth = maxLevelLen * colW - GAP_X;

  const placed = new Map<string, PlacedNode>();
  const levelMeta: TreeLayout["levelMeta"] = [];
  [...orderedLevels.keys()].forEach((g, ri) => {
    const ids = orderedLevels.get(g)!;
    const levelW = ids.length * colW - GAP_X;
    const offset = (maxWidth - levelW) / 2;
    const top = ri * ROW_H + PAD;
    levelMeta.push({ gen: g, label: genLabel(g), count: ids.length });
    ids.forEach((id, col) => {
      placed.set(id, { id, cx: offset + col * colW + CARD_W / 2, top });
    });
  });

  const edges: Edge[] = [];
  const edgeKey = new Set<string>();
  for (const m of members) {
    // Orang tua → anak (garis "siku" vertikal).
    for (const pid of m.parent_ids ?? []) {
      if (pid !== m.id && placed.has(pid) && placed.has(m.id)) {
        const key = `${pid}>${m.id}`;
        if (!edgeKey.has(key)) {
          edgeKey.add(key);
          edges.push({ from: pid, to: m.id, kind: "parent_child" });
        }
      }
    }
    // Saudara kandung (sebaris, garis horizontal).
    for (const sid of m.sibling_ids ?? []) {
      if (sid === m.id || !placed.has(sid) || !placed.has(m.id)) continue;
      const key = [m.id, sid].sort().join("<");
      if (!edgeKey.has(key)) {
        edgeKey.add(key);
        edges.push({ from: m.id, to: sid, kind: "sibling" });
      }
    }
    // Pasangan (sebaris, garis horizontal).
    for (const sp of m.spouse_ids ?? []) {
      if (sp === m.id || !placed.has(sp) || !placed.has(m.id)) continue;
      const key = [m.id, sp].sort().join("<");
      if (!edgeKey.has(key)) {
        edgeKey.add(key);
        edges.push({ from: m.id, to: sp, kind: "spouse" });
      }
    }
  }

  const totalH = orderedLevels.size * ROW_H + PAD * 2;
  const totalW = Math.max(maxWidth + PAD * 2, 520);
  return { placed, edges, levelMeta, totalW, totalH };
}

/** Path garis penghubung antar kartu. */
function edgePath(from: PlacedNode, to: PlacedNode, kind: EdgeKind): string {
  if (kind === "parent_child") {
    // Garis "siku" dari bawah orang tua ke atas anak.
    const x1 = from.cx;
    const y1 = from.top + CARD_H;
    const x2 = to.cx;
    const y2 = to.top;
    if (Math.abs(x1 - x2) < 1) {
      return `M ${x1} ${y1} L ${x1} ${y2}`;
    }
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  }
  // Relasi sebaris (pasangan/saudara): garis horizontal antara tepi kartu.
  const left = from.cx <= to.cx ? from : to;
  const right = from.cx <= to.cx ? to : from;
  const y = from.top + CARD_H / 2;
  const x1 = left.cx + CARD_W / 2;
  const x2 = right.cx - CARD_W / 2;
  return `M ${x1} ${y} L ${x2} ${y}`;
}

function yearOf(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})/.exec(iso);
  return m ? m[1] : "";
}

function TreeCard({
  member,
  isRoot,
  x,
  y,
  onMakeRoot,
}: {
  member: Member;
  isRoot: boolean;
  x: number;
  y: number;
  onMakeRoot: (id: string) => void;
}) {
  const birthYear = yearOf(member.birth_date);
  const deathYear = yearOf(member.death_date);

  return (
    <div
      className={cn(
        "absolute flex flex-col rounded-lg border bg-card p-2.5 shadow-sm transition-colors hover:bg-accent/60",
        isRoot && "border-primary/50 ring-2 ring-primary/30",
      )}
      style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
    >
      <Link
        href={`/members/${member.id}`}
        className="flex min-w-0 items-center gap-1.5 text-sm font-medium hover:underline"
        title={`Lihat detail ${member.name}`}
      >
        <span className="shrink-0">{GENDER_ICONS[member.gender]}</span>
        <span className="truncate">{member.name}</span>
      </Link>

      <div className="mt-1.5 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        {birthYear && <span title="Lahir">🗓 {birthYear}</span>}
        {deathYear && <span title="Wafat">✝ {deathYear}</span>}
      </div>

      <div className="mt-auto flex items-center gap-1">
        {isRoot && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            ★ Fokus
          </span>
        )}
        <button
          type="button"
          title="Jadikan pusat pohon"
          onClick={() => onMakeRoot(member.id)}
          className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Target className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function TreeView({
  tree,
  onMakeRoot,
}: {
  tree: FamilyTree;
  onMakeRoot: (id: string) => void;
}) {
  const layout = layoutTree(tree);

  return (
    <div className="space-y-3">
      {tree.truncated && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          ⚠️ Pohon dibatasi menampilkan{" "}
          <strong>
            {tree.total_nodes ?? layout.levelMeta.reduce((a, l) => a + l.count, 0)}
          </strong>{" "}
          anggota terdekat agar tetap ringan. Gunakan tombol <strong>🎯</strong> pada kartu untuk
          menjadikannya pusat pohon dan melihat cabang keluarganya.
        </p>
      )}

      <div className="overflow-auto rounded-xl border bg-background/60 p-2">
        <div className="relative" style={{ width: layout.totalW, height: layout.totalH }}>
          {/* Garis penghubung */}
          <svg
            className="pointer-events-none absolute inset-0"
            width={layout.totalW}
            height={layout.totalH}
            aria-hidden="true"
          >
            {layout.edges.map((e, i) => {
              const from = layout.placed.get(e.from);
              const to = layout.placed.get(e.to);
              if (!from || !to) return null;
              return (
                <path
                  key={i}
                  d={edgePath(from, to, e.kind)}
                  fill="none"
                  strokeWidth={e.kind === "spouse" ? 2 : 1.5}
                  strokeDasharray={e.kind === "parent_child" ? undefined : "4 4"}
                  className={cn(
                    e.kind === "parent_child" && "stroke-sky-500",
                    e.kind === "spouse" && "stroke-rose-500",
                    e.kind === "sibling" && "stroke-emerald-500",
                  )}
                />
              );
            })}
          </svg>

          {/* Kartu anggota */}
          {Object.values(tree.family).map((m) => {
            const p = layout.placed.get(m.id);
            if (!p) return null;
            return (
              <TreeCard
                key={m.id}
                member={m}
                isRoot={m.id === tree.root_id}
                x={p.cx - CARD_W / 2}
                y={p.top}
                onMakeRoot={onMakeRoot}
              />
            );
          })}
        </div>
      </div>

      {/* Legenda generasi */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Baris generasi:</span>
        {layout.levelMeta.map((l) => (
          <span
            key={l.gen}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5"
          >
            <span className="font-semibold text-foreground">{l.label}</span>
            <span>({l.count})</span>
          </span>
        ))}
      </div>

      {/* Legenda garis relasi */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Garis relasi:</span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="22" y2="4" strokeWidth="1.5" className="stroke-sky-500" />
          </svg>
          Orang tua–anak
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden="true">
            <line
              x1="0"
              y1="4"
              x2="22"
              y2="4"
              strokeWidth="2"
              strokeDasharray="4 4"
              className="stroke-rose-500"
            />
          </svg>
          Pasangan
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden="true">
            <line
              x1="0"
              y1="4"
              x2="22"
              y2="4"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              className="stroke-emerald-500"
            />
          </svg>
          Saudara kandung
        </span>
      </div>
    </div>
  );
}
