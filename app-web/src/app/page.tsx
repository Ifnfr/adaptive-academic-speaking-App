"use client";

import { useState } from "react";

// Option lists kept as plain string arrays so they are easy to edit later.
const LEVELS = ["Foundation", "Beginner", "Intermediate", "Advanced", "Expert"] as const;
const MODES = ["Fluency Sprint", "Argument Drill", "Reading-to-Speaking", "Debate"] as const;
const FEEDBACK_TYPES = ["Quick", "Deep"] as const;
const SESSION_TYPES = ["Micro", "Standard", "Deep"] as const;
const AI_PROVIDERS = ["Claude", "DeepSeek", "Gemini"] as const;

type Level = (typeof LEVELS)[number];
type Mode = (typeof MODES)[number];
type FeedbackType = (typeof FEEDBACK_TYPES)[number];
type SessionType = (typeof SESSION_TYPES)[number];
type AIProvider = (typeof AI_PROVIDERS)[number];

export default function Home() {
  const [level, setLevel] = useState<Level>("Intermediate");
  const [mode, setMode] = useState<Mode>("Fluency Sprint");
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("Quick");
  const [sessionType, setSessionType] = useState<SessionType>("Standard");
  const [aiProvider, setAiProvider] = useState<AIProvider>("Claude");
  const [target, setTarget] = useState("");

  const handleStart = () => {
    // For now, just log. Real session flow will be wired in later batches.
    const payload = { level, mode, feedbackType, sessionType, aiProvider, target };
    console.log("Start session:", payload);
  };

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12 sm:py-16">
        {/* Header */}
        <header className="flex flex-col gap-2 text-center sm:text-left">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Adaptive Academic Speaking App
          </h1>
          <p className="text-sm text-neutral-400 sm:text-base">
            AI-powered deliberate speaking practice.
          </p>
        </header>

        {/* Setup panel */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
          <h2 className="mb-6 text-lg font-medium text-neutral-200">
            Session setup
          </h2>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SelectField
              label="Level"
              value={level}
              options={LEVELS}
              onChange={(v) => setLevel(v as Level)}
            />
            <SelectField
              label="Mode"
              value={mode}
              options={MODES}
              onChange={(v) => setMode(v as Mode)}
            />
            <SelectField
              label="Feedback Type"
              value={feedbackType}
              options={FEEDBACK_TYPES}
              onChange={(v) => setFeedbackType(v as FeedbackType)}
            />
            <SelectField
              label="Session Type"
              value={sessionType}
              options={SESSION_TYPES}
              onChange={(v) => setSessionType(v as SessionType)}
            />
            <div className="sm:col-span-2">
              <SelectField
                label="AI Provider"
                value={aiProvider}
                options={AI_PROVIDERS}
                onChange={(v) => setAiProvider(v as AIProvider)}
              />
            </div>

            {/* Today's Target */}
            <div className="sm:col-span-2">
              <label
                htmlFor="target"
                className="mb-2 block text-sm font-medium text-neutral-300"
              >
                Today&apos;s Target
              </label>
              <textarea
                id="target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                rows={4}
                placeholder="What do you want to improve in this session?"
                className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
              />
            </div>
          </div>

          {/* Start button */}
          <div className="mt-8">
            <button
              type="button"
              onClick={handleStart}
              className="w-full rounded-lg bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-900 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 focus:ring-offset-neutral-950"
            >
              Start Session
            </button>
          </div>
        </section>

        <footer className="text-center text-xs text-neutral-500">
          MVP build · Local state only
        </footer>
      </main>
    </div>
  );
}

// Small reusable select field. Kept in the same file to match the
// "single-file, beginner-readable" constraint of this batch.
type SelectFieldProps = {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
};

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex flex-col">
      <label
        htmlFor={id}
        className="mb-2 text-sm font-medium text-neutral-300"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-neutral-950">
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
