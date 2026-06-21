"use client";

import Link from "next/link";
import { ListeningExerciseSession } from "../components/listening-exercise/ListeningExerciseSession";

export default function ListeningExercisePage() {
  return (
    <main className="p-8 max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-[var(--brand-border)] pb-4">
        <h1 className="text-2xl font-bold text-[var(--brand-ink)]">
          Academic Listening Assessment
        </h1>
        <Link
          href="/"
          className="app-button app-button-ghost text-sm flex items-center gap-1.5"
        >
          ← Back to Fonetik
        </Link>
      </div>
      <ListeningExerciseSession
        initialCefrLevel="B2"
        initialSectionCount={3}
        initialIsPlacement={false}
      />
    </main>
  );
}
