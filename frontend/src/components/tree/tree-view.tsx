"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Target } from "lucide-react";
import type { FamilyTree, Member } from "@/lib/types";
import { GENDER_ICONS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

interface LayoutEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

interface TreeLayout {
  placed: Map<string, PlacedNode>;
  edges: LayoutEdge[];
  levelMeta: { gen: number; label: string; count: number }[];
}

// ── Tipe & konstanta untuk React Flow ────────────────────────────────────────
type MemberNodeData = {
  member: Member;
  isRoot: boolean;
  onMakeRoot: (id: string) => void;
};

type MemberFlowNode = Node<MemberNodeData, "member">;
type MemberFlowEdge = Edge & { kind: EdgeKind };

const HANDLE_STYLE: CSSProperties = {
  width: 0,
  height: 0,
  border: "none",
  opacity: 0,
  background: "transparent",
  pointerEvents: "none",
};

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

  const edges: LayoutEdge[] = [];
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

  return { placed, edges, levelMeta };
}

function yearOf(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})/.exec(iso);
  return m ? m[1] : "";
}

/**
 * Kartu anggota sebagai node React Flow. Posisi kartu ditentukan React Flow
 * dari data node; di tepi kartu ada `Handle` tersembunyi sebagai titik sambung
 * garis (atas/bawah untuk orang tua–anak, kiri/kanan untuk pasangan/saudara).
 */
function MemberCard({ data }: NodeProps<MemberFlowNode>) {
  const { member, isRoot, onMakeRoot } = data;
  const birthYear = yearOf(member.birth_date);
  const deathYear = yearOf(member.death_date);

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-card p-2.5 shadow-sm transition-colors hover:bg-accent/60",
        isRoot && "border-primary/50 ring-2 ring-primary/30",
      )}
      style={{ width: CARD_W, height: CARD_H }}
    >
      <Link
        href={`/members/${member.id}`}
        className="nodrag flex min-w-0 items-center gap-1.5 text-sm font-medium hover:underline"
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
          className="nodrag ml-auto rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Target className="size-3.5" />
        </button>
      </div>

      {/* Handle tersembunyi — titik sambung garis antar kartu */}
      <Handle type="target" position={Position.Top} id="top" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} id="right" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Left} id="left" style={HANDLE_STYLE} />
    </div>
  );
}

const nodeTypes = { member: MemberCard };

/** Tombol untuk mengembalikan kartu ke posisi layout otomatis setelah digeser. */
function ResetLayoutButton({ layoutNodes }: { layoutNodes: MemberFlowNode[] }) {
  const { setNodes, fitView } = useReactFlow<MemberFlowNode, MemberFlowEdge>();

  return (
    <Panel position="top-center">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="bg-background/90 text-xs shadow-sm backdrop-blur"
        onClick={() => {
          setNodes(layoutNodes);
          window.requestAnimationFrame(() => fitView({ padding: 0.2 }));
        }}
      >
        ↺ Atur ulang posisi
      </Button>
    </Panel>
  );
}

/**
 * Ubah hasil layout menjadi `nodes`/`edges` untuk React Flow.
 * - Orang tua → anak: garis siku (smoothstep) biru, dari handle bawah ke atas.
 * - Pasangan/saudara: garis horizontal putus-putus antar tepi kartu.
 */
function buildFlow(tree: FamilyTree, onMakeRoot: (id: string) => void) {
  const layout = layoutTree(tree);

  const nodes: MemberFlowNode[] = Object.values(tree.family).map((m) => {
    const p = layout.placed.get(m.id);
    if (!p) {
      throw new Error(`Member ${m.id} tidak punya posisi di layout pohon`);
    }
    return {
      id: m.id,
      type: "member",
      position: { x: p.cx - CARD_W / 2, y: p.top },
      width: CARD_W,
      height: CARD_H,
      data: { member: m, isRoot: m.id === tree.root_id, onMakeRoot },
    };
  });

  const edges: MemberFlowEdge[] = [];
  layout.edges.forEach((e, i) => {
    const a = layout.placed.get(e.from);
    const b = layout.placed.get(e.to);
    if (!a || !b) return;

    if (e.kind === "parent_child") {
      edges.push({
        id: `edge-${i}`,
        source: e.from,
        target: e.to,
        sourceHandle: "bottom",
        targetHandle: "top",
        type: "smoothstep",
        kind: e.kind,
        style: { stroke: "#0ea5e9", strokeWidth: 1.5 },
      });
      return;
    }

    const isSpouse = e.kind === "spouse";
    const left = a.cx <= b.cx ? e.from : e.to;
    const right = left === e.from ? e.to : e.from;
    edges.push({
      id: `edge-${i}`,
      source: left,
      target: right,
      sourceHandle: "right",
      targetHandle: "left",
      type: "straight",
      kind: e.kind,
      style: {
        stroke: isSpouse ? "#f43f5e" : "#10b981",
        strokeWidth: isSpouse ? 2 : 1.5,
        strokeDasharray: "4 4",
      },
    });
  });

  return { nodes, edges, levelMeta: layout.levelMeta };
}

export default function TreeView({
  tree,
  onMakeRoot,
}: {
  tree: FamilyTree;
  onMakeRoot: (id: string) => void;
}) {
  const { nodes, edges, levelMeta } = useMemo(
    () => buildFlow(tree, onMakeRoot),
    [tree, onMakeRoot],
  );

  return (
    <div className="space-y-3">
      {tree.truncated && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          ⚠️ Pohon dibatasi menampilkan{" "}
          <strong>
            {tree.total_nodes ?? levelMeta.reduce((a, l) => a + l.count, 0)}
          </strong>{" "}
          anggota terdekat agar tetap ringan. Gunakan tombol <strong>🎯</strong> pada kartu untuk
          menjadikannya pusat pohon dan melihat cabang keluarganya.
        </p>
      )}

      <div className="h-[70vh] min-h-[460px] overflow-hidden rounded-xl border bg-background/60">
        <ReactFlow
          key={tree.root_id ?? "tree"}
          defaultNodes={nodes}
          defaultEdges={edges}
          nodeTypes={nodeTypes}
          colorMode="light"
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.05}
          maxZoom={2}
          nodesConnectable={false}
          panOnScroll
          zoomOnScroll={false}
          deleteKeyCode={null}
        >
          <Background gap={16} size={1} />
          <Controls position="bottom-left" showInteractive={false} />
          <MiniMap position="top-right" pannable zoomable nodeColor="#0ea5e9" />
          <ResetLayoutButton layoutNodes={nodes} />
        </ReactFlow>
      </div>

      <p className="text-xs text-muted-foreground">
        💡 Seret kartu untuk menyusun ulang posisi · gulir untuk geser · Ctrl/⌘ + gulir (atau
        pinch) untuk zoom · klik kartu untuk lihat detail.
      </p>

      {/* Legenda generasi */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Baris generasi:</span>
        {levelMeta.map((l) => (
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
