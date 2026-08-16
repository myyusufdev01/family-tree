import { listMembers } from "./firestore";
import type {
  DashboardStats,
  Member,
  PersonBrief,
  RecentMember,
  UpcomingBirthday,
} from "./types";

/**
 * Statistik ringkas untuk dashboard (port dari endpoint `/api/dashboard/stats`
 * di `backend/main.py`).
 *
 * Seluruh tanggal diperlakukan sebagai *kalender murni* (pinned ke UTC
 * tengah malam) agar tidak ada bias zona waktu, setara dengan `datetime.date`
 * di Python.
 */

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const iso = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ageOn(birth: Date, ref: Date): number {
  const beforeBirthday =
    ref.getUTCMonth() < birth.getUTCMonth() ||
    (ref.getUTCMonth() === birth.getUTCMonth() &&
      ref.getUTCDate() < birth.getUTCDate());
  return (
    ref.getUTCFullYear() -
    birth.getUTCFullYear() -
    (beforeBirthday ? 1 : 0)
  );
}

/** Hari ini sebagai kalender UTC (tanpa jam). */
function todayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** Ganti tahun tanggal lahir; null bila tidak valid (mis. 29 Feb non-kabisat). */
function replaceYear(birth: Date, year: number): Date | null {
  const d = new Date(Date.UTC(year, birth.getUTCMonth(), birth.getUTCDate()));
  if (
    d.getUTCMonth() !== birth.getUTCMonth() ||
    d.getUTCDate() !== birth.getUTCDate()
  ) {
    return null;
  }
  return d;
}

function daysUntil(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

/** Hitung seluruh statistik dashboard dari daftar anggota. */
export function computeDashboardStats(members: Member[]): DashboardStats {
  const today = todayUtc();

  const total = members.length;
  const maleCount = members.filter((m) => m.gender === "male").length;
  const femaleCount = members.filter((m) => m.gender === "female").length;
  const deceasedCount = members.filter((m) => m.death_date).length;
  const withoutBirthdateCount = members.filter((m) => !m.birth_date).length;

  // ── Kelompok usia (usia saat ini; bila wafat, usia saat wafat) ──
  const ageGroups: DashboardStats["age_groups"] = [
    { key: "anak", label: "Anak-anak (0–11)", count: 0 },
    { key: "remaja", label: "Remaja (12–17)", count: 0 },
    { key: "dewasa", label: "Dewasa (18–59)", count: 0 },
    { key: "lansia", label: "Lansia (60+)", count: 0 },
    { key: "unknown", label: "Usia tidak diketahui", count: 0 },
  ];
  const groupIdx = new Map(ageGroups.map((g, i) => [g.key, i]));
  const ages: number[] = [];

  for (const m of members) {
    const birth = parseIsoDate(m.birth_date);
    if (!birth) {
      ageGroups[groupIdx.get("unknown") as number].count += 1;
      continue;
    }
    const death = parseIsoDate(m.death_date);
    const ref = death ?? today;
    const age = ageOn(birth, ref);
    ages.push(age);
    let key: string;
    if (age < 12) key = "anak";
    else if (age < 18) key = "remaja";
    else if (age < 60) key = "dewasa";
    else key = "lansia";
    ageGroups[groupIdx.get(key) as number].count += 1;
  }

  const avgAge =
    ages.length > 0
      ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10
      : null;

  // ── Relasi keluarga ──
  const spousePairs = new Set<string>();
  for (const m of members) {
    for (const s of m.spouse_ids) spousePairs.add(pairKey(m.id, s));
  }
  const parentChildPairs = new Set<string>();
  for (const m of members) {
    for (const p of m.parent_ids) parentChildPairs.add(pairKey(p, m.id));
  }
  const connectedCount = members.filter(
    (m) =>
      m.parent_ids.length > 0 ||
      m.child_ids.length > 0 ||
      m.spouse_ids.length > 0 ||
      m.sibling_ids.length > 0,
  ).length;

  // ── Ulang tahun dalam 14 hari ke depan ──
  const upcomingBirthdays: UpcomingBirthday[] = [];
  for (const m of members) {
    const birth = parseIsoDate(m.birth_date);
    if (!birth || parseIsoDate(m.death_date)) continue;
    let nextBirth = replaceYear(birth, today.getUTCFullYear());
    if (!nextBirth) continue; // mis. 29 Februari di tahun non-kabisat
    if (nextBirth.getTime() < today.getTime()) {
      nextBirth = replaceYear(birth, today.getUTCFullYear() + 1);
      if (!nextBirth) continue;
    }
    const days = daysUntil(today, nextBirth);
    if (days >= 0 && days <= 14) {
      upcomingBirthdays.push({
        id: m.id,
        name: m.name,
        gender: m.gender,
        birth_date: m.birth_date,
        days_until: days,
      });
    }
  }
  upcomingBirthdays.sort((a, b) => a.days_until - b.days_until);

  // ── Generasi keluarga (rantai orang tua → anak; 1 = generasi tertua) ──
  const byId = new Map(members.map((m) => [m.id, m]));
  const generationOf = new Map<string, number>();
  const pending: string[] = [];
  for (const m of members) {
    if (m.parent_ids.length === 0 || m.parent_ids.every((p) => !byId.has(p))) {
      generationOf.set(m.id, 1);
      pending.push(m.id);
    }
  }
  while (pending.length > 0) {
    const mid = pending.shift() as string;
    const current = generationOf.get(mid) as number;
    const node = byId.get(mid);
    if (!node) continue;
    for (const cid of node.child_ids) {
      if (byId.has(cid) && !generationOf.has(cid)) {
        generationOf.set(cid, current + 1);
        pending.push(cid);
      }
    }
  }
  for (const m of members) {
    // relasi yang terputus dianggap generasi 1
    if (!generationOf.has(m.id)) generationOf.set(m.id, 1);
  }
  const levelCounts = new Map<number, number>();
  for (const g of generationOf.values()) {
    levelCounts.set(g, (levelCounts.get(g) ?? 0) + 1);
  }
  const generationLevels = [...levelCounts.keys()]
    .sort((a, b) => a - b)
    .map((lvl) => ({
      level: lvl,
      label: `Generasi ${lvl}`,
      count: levelCounts.get(lvl) as number,
    }));
  const generationDepth =
    levelCounts.size > 0 ? Math.max(...levelCounts.keys()) : 0;

  // ── Ulang tahun bulan ini ──
  const birthdaysThisMonth: UpcomingBirthday[] = [];
  for (const m of members) {
    const birth = parseIsoDate(m.birth_date);
    if (!birth || parseIsoDate(m.death_date)) continue;
    if (birth.getUTCMonth() === today.getUTCMonth()) {
      const thisYearBirth = replaceYear(birth, today.getUTCFullYear());
      if (!thisYearBirth) continue;
      birthdaysThisMonth.push({
        id: m.id,
        name: m.name,
        gender: m.gender,
        birth_date: m.birth_date,
        days_until: daysUntil(today, thisYearBirth),
      });
    }
  }
  birthdaysThisMonth.sort(
    (a, b) =>
      (a.days_until < 0 ? 1 : 0) - (b.days_until < 0 ? 1 : 0) ||
      a.days_until - b.days_until,
  );

  // ── Anggota hidup termuda & tertua ──
  const living = members.filter(
    (m) => m.birth_date && !parseIsoDate(m.death_date),
  );
  let oldestLiving: PersonBrief | null = null;
  let youngestMember: PersonBrief | null = null;
  if (living.length > 0) {
    const byBirth = [...living].sort((a, b) =>
      (a.birth_date ?? "").localeCompare(b.birth_date ?? ""),
    );
    const oldest = byBirth[0];
    const youngest = byBirth[byBirth.length - 1];
    oldestLiving = {
      id: oldest.id,
      name: oldest.name,
      gender: oldest.gender,
      birth_date: oldest.birth_date,
      age: ageOn(parseIsoDate(oldest.birth_date) as Date, today),
    };
    youngestMember = {
      id: youngest.id,
      name: youngest.name,
      gender: youngest.gender,
      birth_date: youngest.birth_date,
      age: ageOn(parseIsoDate(youngest.birth_date) as Date, today),
    };
  }

  // ── Peran & kelengkapan data ──
  const parentsCount = members.filter((m) => m.child_ids.length > 0).length;
  const singleParentCount = members.filter(
    (m) => m.child_ids.length > 0 && m.spouse_ids.length === 0,
  ).length;
  const withoutPhoneCount = members.filter((m) => !m.phone).length;

  // ── Anggota terbaru (berdasarkan created_at) ──
  const recentMembers: RecentMember[] = [...members]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 5)
    .map((m) => ({
      id: m.id,
      name: m.name,
      gender: m.gender,
      birth_date: m.birth_date,
      created_at: m.created_at,
    }));

  return {
    total_members: total,
    male_count: maleCount,
    female_count: femaleCount,
    deceased_count: deceasedCount,
    avg_age: avgAge,
    age_groups: ageGroups,
    couples_count: spousePairs.size,
    parent_child_count: parentChildPairs.size,
    connected_count: connectedCount,
    isolated_count: total - connectedCount,
    without_birthdate_count: withoutBirthdateCount,
    upcoming_birthdays: upcomingBirthdays.slice(0, 6),
    birthdays_this_month: birthdaysThisMonth.slice(0, 6),
    generation_depth: generationDepth,
    generation_levels: generationLevels,
    oldest_living: oldestLiving,
    youngest_member: youngestMember,
    parents_count: parentsCount,
    single_parent_count: singleParentCount,
    without_phone_count: withoutPhoneCount,
    recent_members: recentMembers,
  };
}

/** Statistik dashboard untuk satu pohon (user_id). */
export async function getDashboardStats(userId: number): Promise<DashboardStats> {
  const members = await listMembers(userId);
  return computeDashboardStats(members);
}

