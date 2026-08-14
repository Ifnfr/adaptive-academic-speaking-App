// app-web/src/app/api/listening-exercise/_lib/plan-prompts.ts
//
// PLAN-ONLY prompt builders. The plan is generated in a small, fast AI call
// first; section content is generated in later calls (buildNextSection*),
// so each AI call is smaller and the first content arrives faster.

export function buildPlanOnlySystemPrompt(): string {
  return [
    "You are an expert AI English academic listening content designer for the Fonetik application.",
    "Your task is to generate ONLY the session generation plan (PHASE 1 & 2). Do NOT generate any section content, audio scripts, questions, or fact units.",
    "",
    "PHASE 1: ANALYSIS",
    "Analyze the learner's previous listening attempts history (if provided) to identify strengths and weaknesses. If no history is provided or is_placement is true, summarize that this is a new placement session.",
    "",
    "PHASE 2: PLANNING",
    "Plan the overall CEFR level and topic progression across exactly 3 sections. The plan must define a 3-phase session where:",
    "  - Section index 0 is always Fill-in-the-blank ('fill_blank').",
    "  - Section index 1 is always Multiple Choice ('multiple_choice').",
    "  - Section index 2 is always True/False ('true_false').",
    "The plan must match this exact layout. The CEFR level should match the requested average CEFR level.",
    "The user prompt provides this session's 3 section topics as pre-assigned, required values. You MUST use them verbatim as the 'topic' field for each corresponding section in your plan output — do not invent, alter, or substitute different topics.",
    "",
    "JSON ENFORCEMENT: Return strictly valid JSON matching this exact schema — nothing else, no 'section' key:",
    "{",
    '  "plan": {',
    '    "cefr_level": "A1-C2",',
    '    "section_count": 3,',
    '    "sections": [',
    '      { "section_index": 0, "cefr_level": "A1-C2", "topic": "topic name 1", "question_types": ["fill_blank"] },',
    '      { "section_index": 1, "cefr_level": "A1-C2", "topic": "topic name 2", "question_types": ["multiple_choice"] },',
    '      { "section_index": 2, "cefr_level": "A1-C2", "topic": "topic name 3", "question_types": ["true_false"] }',
    "    ]",
    "  }",
    "}",
  ].join("\n");
}

export function buildPlanOnlyUserPrompt(
  cefrLevel: string,
  sectionCount: number,
  isPlacement: boolean,
  historySummary?: string,
  weakSubSkill?: string | null,
  assignedTopics?: Array<{ domainId: string; topic: string }>
): string {
  const assignedTopicsLine =
    assignedTopics && assignedTopics.length > 0
      ? `Section topics are pre-assigned and MUST be used exactly as given for the 'topic' field of the corresponding section — do not substitute, reinterpret, or rephrase them: Section 0 (fill_blank): '${assignedTopics[0]?.topic ?? ""}'. Section 1 (multiple_choice): '${assignedTopics[1]?.topic ?? ""}'. Section 2 (true_false): '${assignedTopics[2]?.topic ?? ""}'.`
      : null;
  const lines = [
    "Generate Listening Exercise StartSession plan only.",
    `Requested CEFR Level: ${cefrLevel}`,
    `Section Count: ${sectionCount}`,
    `Is Placement Session: ${isPlacement}`,
    historySummary ? `Previous Session History Summary:\n${historySummary}` : "No previous history available.",
  ];
  if (weakSubSkill) {
    lines.push(
      `The learner has recently shown comparatively weaker performance on "${weakSubSkill}"-type questions. Where it fits naturally with the session plan, prefer choosing topics and question slants that give more practice on that sub-skill.`
    );
  }
  if (assignedTopicsLine) lines.push(assignedTopicsLine);
  return lines.join("\n");
}
