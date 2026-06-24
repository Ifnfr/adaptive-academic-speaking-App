"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const CATEGORY_LABELS: Record<string, string> = {
  auxiliary_verb: "Auxiliary Verb",
  subject_verb_agreement: "Subject-Verb Agreement",
  tense: "Verb Tenses",
  article: "Articles",
  preposition: "Prepositions",
  word_order: "Word Order",
  verb_form: "Verb Forms",
};

export default function WordBuilderDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch("/api/word-builder/metrics");
        if (!res.ok) {
          throw new Error(`Failed to fetch metrics: ${res.statusText}`);
        }
        const data = await res.json();
        setMetrics(data);
      } catch (err: any) {
        console.error("Dashboard fetch error:", err);
        setError(err.message || "Failed to load metrics data.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchMetrics();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400 font-sans">
        <div className="flex flex-col items-center space-y-4">
          {/* Subtle spinning loader */}
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium tracking-wide">Loading metrics...</span>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-4 font-sans">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <div className="text-red-400 text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-white">Metrics Failed to Load</h2>
          <p className="text-sm text-zinc-400">{error || "An unexpected error occurred."}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-sm font-semibold rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Helper for trend formatting
  function renderTrend(trend: string) {
    if (trend === "improving") {
      return <span className="text-green-400 font-bold ml-1">↑</span>;
    }
    if (trend === "deteriorating") {
      return <span className="text-red-400 font-bold ml-1">↓</span>;
    }
    return <span className="text-zinc-500 font-bold ml-1">→</span>;
  }

  // Format category key to label
  const getCategoryLabel = (cat: string) => CATEGORY_LABELS[cat] || cat;

  // Format weakest category label
  const weakestLabel = metrics.weakestCategory
    ? CATEGORY_LABELS[metrics.weakestCategory] || metrics.weakestCategory
    : "None yet";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-16">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        
        {/* Section 1 — Header */}
        <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between border-b border-zinc-800 pb-6 gap-2">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Word Builder Analytics
            </h1>
            <p className="text-xs text-zinc-500">
              Last updated: {new Date(metrics.calculatedAt).toLocaleString()}
            </p>
          </div>
          <Link
            href="/word-builder/practice"
            className="text-sm font-semibold text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1 self-start sm:self-auto"
          >
            ← Back to practice
          </Link>
        </header>

        {/* Section 2 — Summary Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-md flex flex-col justify-between hover:border-zinc-700 transition-colors duration-200">
            <span className="text-xs font-semibold text-zinc-500 tracking-wider uppercase block mb-2">
              Total Sessions
            </span>
            <span className="text-3xl font-black text-white">{metrics.totalSessions}</span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-md flex flex-col justify-between hover:border-zinc-700 transition-colors duration-200">
            <span className="text-xs font-semibold text-zinc-500 tracking-wider uppercase block mb-2">
              Sentences Produced
            </span>
            <span className="text-3xl font-black text-white">{metrics.totalSentencesProduced}</span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-md flex flex-col justify-between hover:border-zinc-700 transition-colors duration-200">
            <span className="text-xs font-semibold text-zinc-500 tracking-wider uppercase block mb-2">
              Errors Resolved
            </span>
            <span className="text-3xl font-black text-white">{metrics.totalErrorsResolved}</span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-md flex flex-col justify-between hover:border-zinc-700 transition-colors duration-200">
            <span className="text-xs font-semibold text-zinc-500 tracking-wider uppercase block mb-2">
              Weakest Pattern
            </span>
            <span className={`text-xl font-bold truncate ${metrics.weakestCategory ? "text-red-400" : "text-zinc-300"}`}>
              {weakestLabel}
            </span>
          </div>
        </section>

        {/* Section 3 — Data Insufficient Notice */}
        {metrics.dataInsufficient && (
          <section className="bg-amber-950/20 border border-amber-900/60 rounded-xl p-4 flex gap-3 text-amber-200/90 text-sm">
            <span className="shrink-0 text-lg">💡</span>
            <p className="leading-relaxed">
              Keep practicing — adaptive features activate after 50 errors are logged.
              Current data reflects your available session history.
            </p>
          </section>
        )}

        {/* Section 4 — Per-category breakdown */}
        <section className="space-y-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold tracking-wide text-zinc-400 uppercase">
              Grammar Pattern Breakdown
            </h2>
            <span className="text-xs text-zinc-500">Based on rolling window of up to 20 sessions</span>
          </div>

          <div className="space-y-4">
            {metrics.categories.map((cat: any) => {
              // Custom bar colors per spec
              const errorBarColor = cat.errorRate > 0.4 ? "bg-red-500" : "bg-zinc-400";
              const echoBarColor = cat.echoTransferRate > 0.7 ? "bg-green-500" : "bg-zinc-400";
              const autoBarColor = "bg-zinc-400";

              return (
                <div
                  key={cat.category}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 hover:border-zinc-800/80 transition-colors duration-200"
                >
                  {/* Category Header */}
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-base font-bold text-white">
                      {getCategoryLabel(cat.category)}
                    </span>
                    <div className="flex items-center space-x-2 text-xs font-mono text-zinc-400">
                      <span>Trend:</span>
                      {renderTrend(cat.trend)}
                      <span className="text-zinc-500 font-sans">({cat.trend})</span>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    {/* Error Rate */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Error Frequency (Rate)</span>
                        <span className="font-semibold text-zinc-200">
                          {(cat.errorRate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${errorBarColor}`}
                          style={{ width: `${cat.errorRate * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Echo Transfer Rate */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Echo Correct Retention (Transfer)</span>
                        <span className="font-semibold text-zinc-200">
                          {(cat.echoTransferRate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${echoBarColor}`}
                          style={{ width: `${cat.echoTransferRate * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Autonomous Correction Rate */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Self-Correction Rate (Autonomous Fix)</span>
                        <span className="font-semibold text-zinc-200">
                          {(cat.autonomousCorrectionRate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${autoBarColor}`}
                          style={{ width: `${cat.autonomousCorrectionRate * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Hint Dependency Score */}
                    <div className="flex items-center justify-between bg-zinc-950/50 rounded-lg p-2.5 border border-zinc-800/40">
                      <span className="text-xs text-zinc-400">Avg. Hints Per Error (Dependency)</span>
                      <div className="flex items-center space-x-1.5 font-mono">
                        <span className="text-zinc-200 font-bold">{cat.hintDependencyScore.toFixed(2)}</span>
                        <span className="text-zinc-600 text-xs">/ 3.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 5 — Footer note */}
        <footer className="text-center text-xs text-zinc-600 border-t border-zinc-900 pt-6">
          Dashboard updates each time you visit. Data reflects your last 20 sessions.
        </footer>
      </div>
    </div>
  );
}
