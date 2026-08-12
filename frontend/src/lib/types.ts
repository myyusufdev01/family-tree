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
  created_at: string | null;
}

export interface FamilyTree {
  member: Member;
  family: Record<string, Member>;
}

export interface PaginatedMembers {
  members: Member[];
  page: number;
  per_page: number;
  has_more: boolean;
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