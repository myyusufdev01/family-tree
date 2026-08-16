"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { getDashboardStats } from "@/lib/api";
import { toDisplayDate, toDisplayMonthYear } from "@/lib/date-format";
import type { DashboardStats } from "@/lib/types";

/** Warna bar & emoji per kelompok usia (selaras dengan warna garis di pohon). */
const AGE_GROUP_META: Record<string, { emoji: string; bar: string }> = {
  anak: { emoji: "👶", bar: "bg-emerald-500" },
  remaja: { emoji: "🧒", bar: "bg-sky-500" },
  dewasa: { emoji: "🧑", bar: "bg-violet-500" },
  lansia: { emoji: "👴", bar: "bg-amber-500" },
  unknown: { emoji: "❓", bar: "bg-muted-foreground/40" },
};

function pct(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function shortDate(iso: string | null | undefined): string {
  const d = toDisplayDate(iso);
  return d ? d.slice(0, 5) : "";
}

function daysLabel(days: number): string {
  if (days === 0) return "Hari ini 🎉";
  if (days === 1) return "Besok";
  if (days === 2) return "Lusa";
  return `${days} hari lagi`;
}

function Bar({ value, total, className }: { value: number; total: number; className: string }) {
  const width = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function StatCard({
  emoji,
  label,
  value,
  hint,
}: {
  emoji: string;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">
          {emoji} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
      <span className="text-xl">{emoji}</span>
      <div className="min-w-0">
        <p className="text-lg leading-tight font-bold">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function SkeletonCards() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-14" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-44" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={`row2-${i}`}>
            <CardHeader>
              <Skeleton className="h-5 w-44" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={`mini-${i}`}>
            <CardContent className="flex items-center gap-3 py-3">
              <Skeleton className="size-6 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
function StatSection({ stats }: { stats: DashboardStats }) {
  const total = stats.total_members;

  return (
    <>
      {/* Kartu statistik utama */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          emoji="👨‍👩‍👧‍👦"
          label="Total Anggota"
          value={total}
          hint={
            stats.avg_age !== null
              ? `Rata-rata usia ${stats.avg_age} tahun`
              : "Data usia belum lengkap"
          }
        />
        <StatCard
          emoji="👨"
          label="Laki-laki"
          value={stats.male_count}
          hint={`${pct(stats.male_count, total)} dari total anggota`}
        />
        <StatCard
          emoji="👩"
          label="Perempuan"
          value={stats.female_count}
          hint={`${pct(stats.female_count, total)} dari total anggota`}
        />
        <StatCard
          emoji="🕊️"
          label="Wafat"
          value={stats.deceased_count}
          hint={stats.deceased_count > 0 ? "Almarhum / almarhumah" : "Belum tercatat wafat"}
        />
      </div>

      {/* Komposisi, ulang tahun, anggota terbaru */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>🧬 Komposisi Keluarga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>👨 Laki-laki</span>
                <span className="font-semibold">{stats.male_count}</span>
              </div>
              <Bar value={stats.male_count} total={total} className="bg-sky-500" />
              <div className="flex items-center justify-between text-sm">
                <span>👩 Perempuan</span>
                <span className="font-semibold">{stats.female_count}</span>
              </div>
              <Bar value={stats.female_count} total={total} className="bg-rose-500" />
            </div>

            <Separator />

            <div className="space-y-3">
              {stats.age_groups.map((g) => {
                const meta = AGE_GROUP_META[g.key] ?? AGE_GROUP_META.unknown;
                return (
                  <div key={g.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {meta.emoji} {g.label}
                      </span>
                      <span className="font-semibold">{g.count}</span>
                    </div>
                    <Bar value={g.count} total={total} className={meta.bar} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>🎂 Ulang Tahun Mendatang</CardTitle>
            <p className="text-xs text-muted-foreground">14 hari ke depan</p>
          </CardHeader>
          <CardContent>
            {stats.upcoming_birthdays.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada ulang tahun dalam 14 hari ke depan.
              </p>
            ) : (
              <ul className="divide-y">
                {stats.upcoming_birthdays.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 py-2">
                    <Link
                      href={`/members/${b.id}`}
                      className="min-w-0 flex-1 truncate font-medium hover:underline"
                    >
                      {b.gender === "male" ? "👨" : "👩"} {b.name}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {toDisplayMonthYear(b.birth_date)}
                    </span>
                    <Badge variant={b.days_until <= 1 ? "default" : "secondary"}>
                      {daysLabel(b.days_until)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>✨ Anggota Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recent_members.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada anggota. Mulai tambahkan anggota keluarga Anda.
              </p>
            ) : (
              <ul className="divide-y">
                {stats.recent_members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 py-2">
                    <Link
                      href={`/members/${m.id}`}
                      className="min-w-0 flex-1 truncate font-medium hover:underline"
                    >
                      {m.gender === "male" ? "👨" : "👩"} {m.name}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {shortDate(m.birth_date) || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Generasi, usia ekstrem, ulang tahun bulan ini */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>🌳 Generasi Keluarga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-2xl font-bold">
                {stats.generation_depth ?? 0}{" "}
                <span className="text-sm font-normal text-muted-foreground">generasi</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Tingkat silsilah keluarga yang tercatat
              </p>
            </div>
            <div className="space-y-2">
              {stats.generation_levels && stats.generation_levels.length > 0 ? (
                stats.generation_levels.map((g) => (
                  <div key={g.level} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{g.label}</span>
                      <span className="font-semibold">{g.count}</span>
                    </div>
                    <Bar value={g.count} total={total} className="bg-teal-500" />
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Belum ada data relasi keluarga.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>🏆 Termuda & Tertua</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.youngest_member ? (
              <div className="flex items-center gap-3">
                <span className="text-xl">👶</span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/members/${stats.youngest_member.id}`}
                    className="block truncate font-medium hover:underline"
                  >
                    {stats.youngest_member.gender === "male" ? "👨" : "👩"}{" "}
                    {stats.youngest_member.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Termuda · {stats.youngest_member.age} tahun
                  </p>
                </div>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Belum ada data usia anggota.
              </p>
            )}
            <Separator />
            {stats.oldest_living ? (
              <div className="flex items-center gap-3">
                <span className="text-xl">👴</span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/members/${stats.oldest_living.id}`}
                    className="block truncate font-medium hover:underline"
                  >
                    {stats.oldest_living.gender === "male" ? "👨" : "👩"}{" "}
                    {stats.oldest_living.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Tertua · {stats.oldest_living.age} tahun
                  </p>
                </div>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Belum ada data usia anggota.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>📅 Ulang Tahun Bulan Ini</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats.birthdays_this_month || stats.birthdays_this_month.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada ulang tahun bulan ini.
              </p>
            ) : (
              <ul className="divide-y">
                {stats.birthdays_this_month.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 py-2">
                    <Link
                      href={`/members/${b.id}`}
                      className="min-w-0 flex-1 truncate font-medium hover:underline"
                    >
                      {b.gender === "male" ? "👨" : "👩"} {b.name}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {toDisplayMonthYear(b.birth_date)}
                    </span>
                    <Badge
                      variant={
                        b.days_until < 0
                          ? "outline"
                          : b.days_until <= 1
                            ? "default"
                            : "secondary"
                      }
                    >
                      {b.days_until < 0 ? "sudah lewat" : daysLabel(b.days_until)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ringkasan relasi & kelengkapan data */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>🔗 Relasi & Kelengkapan Data</CardTitle>
          <p className="text-xs text-muted-foreground">
            {stats.connected_count} dari {total} anggota sudah terhubung dalam relasi keluarga.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat emoji="💑" label="Pasangan" value={stats.couples_count} />
          <MiniStat emoji="🧑‍🍼" label="Relasi Orang Tua–Anak" value={stats.parent_child_count} />
          <MiniStat emoji="👨‍👩‍👧" label="Orang Tua" value={stats.parents_count ?? 0} />
          <MiniStat emoji="👨‍👧" label="Orang Tua Tunggal" value={stats.single_parent_count ?? 0} />
          <MiniStat emoji="🫥" label="Tanpa Relasi" value={stats.isolated_count} />
          <MiniStat emoji="📝" label="Tanpa Tanggal Lahir" value={stats.without_birthdate_count} />
          <MiniStat emoji="📵" label="Tanpa Telepon" value={stats.without_phone_count ?? 0} />
          <MiniStat emoji="🌳" label="Generasi Tercatat" value={stats.generation_depth ?? 0} />
        </CardContent>
      </Card>
    </>
  );
}

export default function DashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDashboardStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err: unknown) => {
        console.error(err instanceof Error ? err.message : "Gagal memuat statistik");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <SkeletonCards />;
  if (!stats) return null;
  return <StatSection stats={stats} />;
}

