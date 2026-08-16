import { describe, expect, it } from "vitest";
import { toDisplayDate, toDisplayMonthYear } from "@/lib/date-format";

describe("toDisplayMonthYear", () => {
  it("mengubah ISO YYYY-MM-DD menjadi MM/YYYY", () => {
    expect(toDisplayMonthYear("1990-05-20")).toBe("05/1990");
    expect(toDisplayMonthYear("2000-01-01")).toBe("01/2000");
  });

  it("mengembalikan string kosong untuk input kosong/tidak valid", () => {
    expect(toDisplayMonthYear(null)).toBe("");
    expect(toDisplayMonthYear(undefined)).toBe("");
    expect(toDisplayMonthYear("")).toBe("");
    expect(toDisplayMonthYear("1990")).toBe("");
    expect(toDisplayMonthYear("tanggal-salah")).toBe("");
  });
});

describe("toDisplayDate", () => {
  it("tetap berfungsi untuk tanggal lengkap", () => {
    expect(toDisplayDate("1990-05-20")).toBe("20/05/1990");
    expect(toDisplayDate(null)).toBe("");
  });
});
