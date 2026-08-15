import type { Member } from "./types";

/** Label bahasa Indonesia untuk jenis kelamin. */
export const GENDER_LABELS: Record<Member["gender"], string> = {
  male: "Laki-laki",
  female: "Perempuan",
};

/** Ikon emoji untuk jenis kelamin. */
export const GENDER_ICONS: Record<Member["gender"], string> = {
  male: "👨",
  female: "👩",
};

/** Label peran saat menambah relasi keluarga. */
export const REL_ROLE_LABELS: Record<"parent" | "child" | "spouse", string> = {
  parent: "Orang tua dari...",
  child: "Anak dari...",
  spouse: "Pasangan dari...",
};
