"use client";

import { useRef, useState } from "react";
import { CalendarIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { maskDateInput, toDisplayDate, toISODate } from "@/lib/date-format";

interface DateInputProps {
  id?: string;
  /** Nilai tanggal dalam format ISO (YYYY-MM-DD), atau string kosong. */
  value: string;
  /** Dipanggil dengan nilai ISO (YYYY-MM-DD), atau string kosong jika tidak valid. */
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Input tanggal berformat DD/MM/YYYY.
 * Bisa diketik manual (dengan masking otomatis) atau
 * dipilih lewat date picker native via ikon kalender.
 * Nilai yang dilaporkan ke `onChange` selalu ISO (YYYY-MM-DD).
 */
export function DateInput({
  id,
  value,
  onChange,
  placeholder = "DD/MM/YYYY",
  className,
}: DateInputProps) {
  const nativeDateRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => toDisplayDate(value));

  function openNativePicker() {
    try {
      nativeDateRef.current?.showPicker();
    } catch {
      // Browser lama tidak mendukung showPicker; user tetap bisa mengetik manual.
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskDateInput(e.target.value);
    setText(masked);
    onChange(toISODate(masked));
  }

  function handleNativeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const iso = e.target.value;
    setText(toDisplayDate(iso));
    onChange(iso);
  }

  function handleBlur() {
    // Normalisasi: pertahankan teks parsial, tapi pastikan valid ditampilkan utuh.
    setText((current) => {
      const iso = toISODate(current);
      return iso ? toDisplayDate(iso) : current;
    });
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode="numeric"
        maxLength={10}
        value={text}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="pr-9"
      />
      <button
        type="button"
        onClick={openNativePicker}
        tabIndex={-1}
        aria-label="Pilih tanggal dari kalender"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted-foreground transition-colors hover:text-foreground"
      >
        <CalendarIcon className="size-4" />
      </button>
      {/* Input tersembunyi untuk memicu date picker native browser. */}
      <input
        type="date"
        ref={nativeDateRef}
        value={value}
        onChange={handleNativeChange}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
    </div>
  );
}
