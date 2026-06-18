export type PodchatTopic =
  | "Economics"
  | "Technology"
  | "Philosophy & Ethics"
  | "Science & Discovery"
  | "Education & Learning"
  | "Society & Culture"
  | "Global Issues & Environment"
  | "Daily Life & Casual Conversation";

export type PodchatDifficulty = "Beginner" | "Intermediate" | "Advanced" | "Expert";
export type PodchatSessionMode = "normal_timed" | "context_open_ended";

export const DIFFICULTY_DURATION: Record<PodchatDifficulty, number> = {
  Beginner: 180,
  Intermediate: 300,
  Advanced: 600,
  Expert: 900,
};

export const TOPICS: readonly PodchatTopic[] = [
  "Economics",
  "Technology",
  "Philosophy & Ethics",
  "Science & Discovery",
  "Education & Learning",
  "Society & Culture",
  "Global Issues & Environment",
  "Daily Life & Casual Conversation",
];

export const DIFFICULTIES: readonly PodchatDifficulty[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
];

export const DIFFICULTY_LABEL: Record<PodchatDifficulty, string> = {
  Beginner: "3-minute session",
  Intermediate: "5-minute session",
  Advanced: "10-minute session",
  Expert: "15-minute session",
};
