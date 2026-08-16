/**
 * Util format tanggal untuk aplikasi Family Tree.
 * Data tersimpan di backend dalam format ISO (YYYY-MM-DD),
 * namun ditampilkan/diinput user dalam format DD/MM/YYYY.
 */

/** Konversi ISO "YYYY-MM-DD" -> tampilan "DD/MM/YYYY". Kosong jika tidak valid. */
export function toDisplayDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Cek apakah tanggal (hari, bulan, tahun) valid. */
export function isValidDate(day: number, month: number, year: number): boolean {
  if (year < 1900 || year > 2100) return false;
  const dt = new Date(year, month - 1, day);
  return (
    dt.getFullYear() === year &&
    dt.getMonth() === month - 1 &&
    dt.getDate() === day
  );
}

/** Konversi tampilan "DD/MM/YYYY" -> ISO "YYYY-MM-DD". Kosong jika tidak valid. */
export function toISODate(display: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!isValidDate(day, month, year)) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Masking saat mengetik: otomatis menyisipkan "/" dan membatasi 8 digit.
 * Contoh: "20051990" -> "20/05/1990", "20" -> "20", "2005" -> "20/05".
 */
export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
