"use client";

import { ListeningExerciseSession } from "../components/listening-exercise/ListeningExerciseSession";

export default function ListeningExerciseTestPage() {
  return (
    <main className="p-8 max-w-4xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-[var(--brand-ink)]">
        Listening Exercise Sandbox Test Page
      </h1>
      <ListeningExerciseSession
        initialCefrLevel="B2"
        initialSectionCount={2}
        initialIsPlacement={false}
      />
    </main>
  );
}
