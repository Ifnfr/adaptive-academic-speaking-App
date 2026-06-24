"use client";

import { useState, useEffect, useMemo } from "react";

const RULE_CARDS: Record<
  string,
  { title: string; explanation: string; examples: string[] }
> = {
  auxiliary_verb: {
    title: "Auxiliary Verbs",
    explanation:
      "Auxiliary verbs (be, do, have, will, can, should, must) support the main verb in a sentence. In continuous tenses, 'be' must appear before the -ing form. After modal verbs (will, can, should, must), use the bare infinitive — the base form without 'to' or '-ing'.",
    examples: [
      "❌ The economy changing rapidly. → ✅ The economy is changing rapidly.",
      "❌ It will be impact households. → ✅ It will impact households.",
      "❌ She must working harder. → ✅ She must work harder.",
    ],
  },
  subject_verb_agreement: {
    title: "Subject-Verb Agreement",
    explanation:
      "In English, the verb must agree with its subject in number. Singular subjects take a verb ending in -s in the present tense. Plural subjects take the base form. This applies even when the subject and verb are separated by other words.",
    examples: [
      "❌ Inflation happen every year. → ✅ Inflation happens every year.",
      "❌ The prices increases when demand rise. → ✅ The prices increase when demand rises.",
      "❌ The government need to act. → ✅ The government needs to act.",
    ],
  },
  tense: {
    title: "Verb Tenses",
    explanation:
      "Tense must be consistent within a sentence and across related sentences. Use simple present for habits and general truths. Use present continuous for actions happening now. Use simple past for completed actions. Use present perfect for actions with a connection to the present.",
    examples: [
      "❌ Yesterday I go to the market and buy rice. → ✅ Yesterday I went to the market and bought rice.",
      "❌ She has study economics since 2020. → ✅ She has studied economics since 2020.",
      "❌ When inflation rises, unemployment also rise. → ✅ When inflation rises, unemployment also rises.",
    ],
  },
  article: {
    title: "Articles (a, an, the)",
    explanation:
      "Use 'a' before consonant sounds and 'an' before vowel sounds when introducing something for the first time. Use 'the' when referring to something specific or already mentioned. Use no article (zero article) with plural nouns used in a general sense, proper nouns, and abstract concepts.",
    examples: [
      "❌ She is economist. → ✅ She is an economist.",
      "❌ A inflation affects the poor. → ✅ Inflation affects the poor.",
      "❌ I read a book. The book was about a economics. → ✅ I read a book. The book was about economics.",
    ],
  },
  preposition: {
    title: "Prepositions",
    explanation:
      "Prepositions show relationships between words — location, time, direction, or manner. Common time prepositions: 'at' for specific times, 'on' for days and dates, 'in' for months, years, and periods. Common location prepositions: 'at' for specific points, 'in' for enclosed spaces, 'on' for surfaces.",
    examples: [
      "❌ I was born in Monday. → ✅ I was born on Monday.",
      "❌ She arrived at the morning. → ✅ She arrived in the morning.",
      "❌ The store is in the corner. → ✅ The store is on the corner.",
    ],
  },
  word_order: {
    title: "Word Order",
    explanation:
      "English follows Subject-Verb-Object (SVO) order. Adjectives come before the noun they describe. Adverbs of frequency (always, usually, often, sometimes, never) go before the main verb but after the verb 'be'. In questions, the auxiliary verb comes before the subject.",
    examples: [
      "❌ She always is late. → ✅ She is always late.",
      "❌ I have a car red. → ✅ I have a red car.",
      "❌ Why you are studying? → ✅ Why are you studying?",
    ],
  },
  verb_form: {
    title: "Verb Forms",
    explanation:
      "English verbs change form depending on their function. Use the base form after modal verbs. Use the -ing form (gerund) as a subject or after prepositions. Use the past participle with have/has for perfect tenses. Use the infinitive with 'to' after certain verbs like want, need, and decide.",
    examples: [
      "❌ I enjoy to swim every morning. → ✅ I enjoy swimming every morning.",
      "❌ She has went to the market. → ✅ She has gone to the market.",
      "❌ I want studying abroad. → ✅ I want to study abroad.",
    ],
  },
};

interface RuleCardProps {
  categories: string[]; // list of categories to show rule cards for
  onDismiss: () => void; // called when user clicks "Got it, start session"
}

export default function RuleCard({ categories, onDismiss }: RuleCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter out unrecognized categories
  const validCategories = useMemo(() => {
    return (categories ?? []).filter((cat) => cat in RULE_CARDS);
  }, [categories]);

  // If no valid categories, dismiss immediately
  useEffect(() => {
    if (validCategories.length === 0) {
      onDismiss();
    }
  }, [validCategories, onDismiss]);

  if (validCategories.length === 0) {
    return null;
  }

  const currentCategory = validCategories[currentIndex];
  const cardData = RULE_CARDS[currentCategory];

  const handleNext = () => {
    if (currentIndex < validCategories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onDismiss();
    }
  };

  const isLastCard = currentIndex === validCategories.length - 1;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-4 font-sans">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 flex flex-col justify-between min-h-[500px]">
        {/* Header Block */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <span className="text-xs font-semibold tracking-wider text-teal-400 uppercase">
              Pre-Session Focus
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              Card {currentIndex + 1} of {validCategories.length}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            {cardData.title}
          </h2>

          {/* Explanation */}
          <p className="text-sm leading-relaxed text-zinc-300">
            {cardData.explanation}
          </p>
        </div>

        {/* Examples Section */}
        <div className="space-y-3 flex-grow py-4">
          <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase block mb-1">
            Usage Examples
          </span>
          <div className="space-y-3">
            {cardData.examples.map((example, idx) => {
              // Split incorrect and correct parts
              const [incorrect, correct] = example.split("→");

              return (
                <div
                  key={idx}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 space-y-2 hover:border-zinc-700/80 transition-colors duration-200"
                >
                  <div className="flex items-start space-x-2 text-sm text-zinc-400">
                    <span className="shrink-0">{incorrect.trim()}</span>
                  </div>
                  {correct && (
                    <div className="flex items-start space-x-2 text-sm font-medium text-emerald-400 border-t border-zinc-800/30 pt-2">
                      <span className="shrink-0">→ {correct.trim()}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation Block */}
        <div className="border-t border-zinc-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Progress Indicators */}
          <div className="flex space-x-2 order-2 sm:order-1">
            {validCategories.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentIndex ? "w-6 bg-teal-500" : "w-2 bg-zinc-700"
                }`}
              />
            ))}
          </div>

          {/* Button */}
          <button
            onClick={handleNext}
            className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-semibold tracking-wide shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white order-1 sm:order-2"
          >
            {isLastCard ? "Got it, start session" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
