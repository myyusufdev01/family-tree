export interface Member {
  id: string;
  name: string;
  name_lower?: string;
  gender: "male" | "female";
  birth_date: string | null;
  death_date: string | null;
  phone: string | null;
  notes: string | null;
  parent_ids: string[];
  spouse_ids: string[];
  child_ids: string[];
  sibling_ids: string[];
  created_at: string | null;
  /** Akun Auth0 (sub/User ID) yang tertaut ke anggota ini — 1 akun = 1 anggota. */
  auth0_sub?: string | null;
  /** Id group tempat akun user ini terdaftar (diatur admin di bagian Akses Login). */
  group_ids: string[];
  /** User berstatus PIC (Person In Charge) — bisa menambah anggota (otomatis masuk group-nya) dan membuat koneksi antar user di group yang sama. */
  is_pic: boolean;
  /** (Dihitung server-side, tidak disimpan di Firestore) true jika akun Auth0 anggota termasuk daftar admin (`ADMIN_SUBS`). */
  is_admin?: boolean;
}

export interface FamilyTree {
  member: Member;
  family: Record<string, Member>;
  /** Generasi relatif anggota terhadap fokus (root=0, orang tua=-1, anak=+1, dst.) */
  generations?: Record<string, number>;
  root_id?: string;
  /** true jika pohon dipotong karena melewati batas anggota */
  truncated?: boolean;
  total_nodes?: number;
}

export interface PaginatedMembers {
  members: Member[];
  page: number;
  per_page: number;
  has_more: boolean;
  total?: number;
  total_pages?: number;
}

export interface SearchResults {
  results: Member[];
}

// ── Group ──────────────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  /** Kode unik grup (mis. "EXT", "INT") — case-insensitive. */
  code: string;
  code_lower?: string;
  name: string;
  description: string | null;
  created_at: string | null;
}

export interface PaginatedGroups {
  groups: Group[];
  page: number;
  per_page: number;
  has_more: boolean;
  total?: number;
  total_pages?: number;
}

/** Hubungan anggota baru dengan user yang menambah: anak atau pasangan. */
export type NewMemberRelation = "child" | "spouse";

export interface Me {
  member: Member | null;
  is_admin: boolean;
}

export interface AdminUsers {
  users: { user_id: number; name: string; approved_at: string }[];
  admin_subs: string[];
}

export interface AdminStats {
  total_users: number;
  total_members: number;
  total_trees: number;
}

export interface AgeGroup {
  key: string;
  label: string;
  count: number;
}

export interface UpcomingBirthday {
  id: string;
  name: string;
  gender: Member["gender"];
  birth_date: string | null;
  days_until: number;
}

export interface GenerationLevel {
  level: number;
  label: string;
  count: number;
}

export interface PersonBrief {
  id: string;
  name: string;
  gender: Member["gender"];
  birth_date: string | null;
  age: number;
}

export interface RecentMember {
  id: string;
  name: string;
  gender: Member["gender"];
  birth_date: string | null;
  created_at: string | null;
}

export interface DashboardStats {
  total_members: number;
  male_count: number;
  female_count: number;
  deceased_count: number;
  avg_age: number | null;
  age_groups: AgeGroup[];
  couples_count: number;
  parent_child_count: number;
  connected_count: number;
  isolated_count: number;
  without_birthdate_count: number;
  upcoming_birthdays: UpcomingBirthday[];
  birthdays_this_month?: UpcomingBirthday[];
  generation_depth?: number;
  generation_levels?: GenerationLevel[];
  oldest_living?: PersonBrief | null;
  youngest_member?: PersonBrief | null;
  parents_count?: number;
  single_parent_count?: number;
  without_phone_count?: number;
  recent_members: RecentMember[];
}