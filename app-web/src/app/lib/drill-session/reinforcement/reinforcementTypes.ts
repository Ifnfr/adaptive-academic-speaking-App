export interface ReinforcementSessionRecord {
  weaknessTitle: string;
  weaknessDescription: string;
  phase1BaselineCompleteness: "complete" | "partial" | "missing";
  phase2Accuracy: number;
  phase3PressureAccuracy: number | null;
  pressureFailRate: number | null;
  recommendation: string;
  timestamp: string; // ISO string or created_at string
}

export interface ReinforcementScore {
  weaknessTitle: string;
  weaknessDescription: string;
  score: number;
  consecutiveSuccessCount: number;
  isResolved: boolean;
  lastPracticedAt: string;
}

export interface DbSessionLike {
  id?: string;
  target_pattern?: string;
  targetPattern?: string;
  phase2_accuracy?: number;
  phase2Accuracy?: number;
  phase3_pressure_accuracy?: number | null;
  phase3PressureAccuracy?: number | null;
  pressure_fail_rate?: number | null;
  pressureFailRate?: number | null;
  created_at?: string;
  timestamp?: string;
  createdAt?: string;
  saved_summary?: {
    weaknessLabel?: string;
    weaknessDescription?: string;
    weaknessUpdate?: {
      label?: string;
      practiceFocus?: string;
    } | null;
  } | null;
}
