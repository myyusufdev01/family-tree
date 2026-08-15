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

export interface AdminUsers {
  users: { user_id: number; name: string; approved_at: string }[];
  admin_ids: number[];
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
  recent_members: RecentMember[];
}