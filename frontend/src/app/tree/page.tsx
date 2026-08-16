import { Suspense } from "react";
import TreePageContent from "./content";

export default function TreePage() {
  return (
    <Suspense
      fallback={<div className="py-12 text-center text-muted-foreground">Memuat halaman pohon...</div>}
    >
      <TreePageContent />
    </Suspense>
  );
}
