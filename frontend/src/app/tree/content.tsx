"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getTree, searchMembers } from "@/lib/api";
import { GENDER_ICONS } from "@/lib/labels";
import type { FamilyTree, Member } from "@/lib/types";
import TreeView from "@/components/tree/tree-view";

const TREE_OPTS = { max_nodes: 80, depth_up: 3, depth_down: 3 };

export default function TreePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const memberParam = searchParams.get("member");

  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Sedang memuat jika ada member di URL tapi pohonnya belum cocok dengan member itu.
  const loading = !!memberParam && !error && (!tree || tree.root_id !== memberParam);

  useEffect(() => {
    if (!memberParam) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getTree(memberParam, TREE_OPTS);
        if (cancelled) return;
        setError("");
        setTree(data);
      } catch (err: unknown) {
        if (cancelled) return;
        setTree(null);
        setError(err instanceof Error ? err.message : "Gagal memuat pohon");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memberParam]);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await searchMembers(query);
      setResults(data.results);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function selectMember(m: Member) {
    setResults(null);
    setQuery("");
    router.replace(`/tree?member=${m.id}`);
  }

  function handleMakeRoot(id: string) {
    router.replace(`/tree?member=${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>🌳 Pohon Keluarga</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pilih satu anggota sebagai <strong>pusat pohon</strong>. Pohon menampilkan maksimal 80
            anggota terdekat (3 generasi ke atas & ke bawah) agar tetap ringan walau total keluarga
            mencapai ribuan.
          </p>

          <div className="flex gap-2">
            <Input
              placeholder="Cari nama untuk dijadikan pusat pohon..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value.trim()) setResults(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button variant="secondary" onClick={handleSearch} disabled={searching}>
              {searching ? "..." : "🔍 Cari"}
            </Button>
          </div>

          {results && (
            <div className="space-y-1 rounded-lg border p-2">
              {results.length === 0 ? (
                <p className="px-2 py-1 text-sm text-muted-foreground">Tidak ditemukan.</p>
              ) : (
                results.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectMember(m)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <span>{GENDER_ICONS[m.gender]}</span>
                    <span className="font-medium">{m.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">jadikan pusat →</span>
                  </button>
                ))
              )}
            </div>
          )}

          {tree?.member && memberParam === tree.root_id && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Pusat pohon:</span>
              <Link
                href={`/members/${tree.member.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary hover:underline"
              >
                {GENDER_ICONS[tree.member.gender]} {tree.member.name}
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setResults(null);
                  router.replace("/tree");
                }}
              >
                ✕ Ganti
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-8 w-64" />
        </div>
      ) : memberParam && tree ? (
        <TreeView tree={tree} onMakeRoot={handleMakeRoot} />
      ) : !memberParam && (
        <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          🌳 Belum ada pohon yang ditampilkan.
          <br />
          Ketik nama anggota di atas lalu tekan <strong>🔍 Cari</strong>.
        </div>
      )}
    </div>
  );
}

