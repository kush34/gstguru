import { Suspense } from "react";
import HomeClient from "@/components/HomeClient";

export default function Page() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-4xl px-4 py-8 text-sm text-zinc-500">Loading…</main>}>
      <HomeClient />
    </Suspense>
  );
}
