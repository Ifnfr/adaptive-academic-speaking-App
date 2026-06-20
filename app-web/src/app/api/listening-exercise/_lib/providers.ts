
export interface AIProviderResponse {
  text: string;
}

export function resolveListeningProvider(): { providerId: string; apiKey: string; modelName: string } {
  // Support LISTENING_EXERCISE_PROVIDER first, fallback to AI_PLANNING_PROVIDER or gemini
  const providerId = (
    process.env.LISTENING_EXERCISE_PROVIDER ||
    process.env.AI_PLANNING_PROVIDER ||
    "gemini"
  ).toLowerCase();

  let apiKey = "";
  let modelName = "";

  if (providerId === "gemini") {
    apiKey = process.env.GEMINI_API_KEY || "";
    modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  } else if (providerId === "claude") {
    apiKey = process.env.CLAUDE_API_KEY || "";
    modelName = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";
  } else if (providerId === "deepseek") {
    apiKey = process.env.DEEPSEEK_API_KEY || "";
    modelName = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  } else if (providerId === "minimax_m3" || providerId === "minimax") {
    apiKey = process.env.MINIMAX_API_KEY || "";
    modelName = process.env.MINIMAX_MODEL || "MiniMax-M3";
  } else {
    // Fallback to gemini config
    apiKey = process.env.GEMINI_API_KEY || "";
    modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  }

  return { providerId, apiKey, modelName };
}

/**
 * Extracts a JSON object block from text that might contain markdown formatting.
 */
export function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;

  const start = candidate.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Generates mock response for Section 1 (Plan + Section 1 Content)
 */
export function getMockSection1Response(cefrLevel: string, sectionCount: number): string {
  return JSON.stringify({
    reasoning: {
      phase1_analysis: "Mock analysis: user has clean profile history.",
      phase2_planning: `Mock planning: session will proceed with ${sectionCount} sections at CEFR level ${cefrLevel}.`,
      phase3_implementation: "Mock implementation: designing Section 1 content."
    },
    plan: {
      cefr_level: cefrLevel,
      section_count: sectionCount,
      sections: Array.from({ length: sectionCount }, (_, i) => ({
        section_index: i,
        cefr_level: cefrLevel,
        topic: i === 0 ? "Chemistry Basics" : `Academic Lecture Topic ${i + 1}`,
        question_types: ["fill_blank"]
      }))
    },
    section: {
      topic: "Chemistry Basics",
      audio_script: "Welcome to this chemistry lecture. Today we discuss water boiling points. Under standard sea-level atmospheric pressure, pure water always boils at exactly one hundred degrees Celsius. However, at higher altitudes where pressure is lower, water boils at lower temperatures.",
      fact_units: [
        { id: "fact_0", text: "Under standard sea-level atmospheric pressure, pure water always boils at exactly 100 degrees Celsius." },
        { id: "fact_1", text: "At higher altitudes where pressure is lower, water boils at lower temperatures." }
      ],
      questions: [
        {
          id: "q_0",
          question_type: "fill_blank",
          question_text: "Standard sea-level pressure causes water to boil at [blank] degrees Celsius.",
          answer: "100",
          accepted_variants: ["one hundred", "100c"],
          testing_fact_unit_id: "fact_0"
        },
        {
          id: "q_1",
          question_type: "fill_blank",
          question_text: "At higher altitudes, water boils at [blank] temperatures.",
          answer: "lower",
          accepted_variants: ["colder", "lesser"],
          testing_fact_unit_id: "fact_1"
        }
      ]
    }
  });
}

/**
 * Generates mock response for subsequent sections
 */
export function getMockNextSectionResponse(sectionIndex: number, cefrLevel: string, topic: string): string {
  return JSON.stringify({
    reasoning: {
      phase3_implementation: `Mock implementation: generating section ${sectionIndex + 1} content at level ${cefrLevel}.`
    },
    section: {
      topic: topic || `Academic Lecture Topic ${sectionIndex + 1}`,
      audio_script: `This is the transcript for section ${sectionIndex + 1} covering ${topic || 'academic concepts'}. In this part, we examine how pressure decreases with altitude, which is roughly one hectopascal per eight meters.`,
      fact_units: [
        { id: `fact_${sectionIndex}_0`, text: `Pressure decreases with altitude at approximately one hectopascal per eight meters.` }
      ],
      questions: [
        {
          id: `q_${sectionIndex}_0`,
          question_type: "fill_blank",
          question_text: "Pressure decreases with altitude by one hectopascal every [blank] meters.",
          answer: "eight",
          accepted_variants: ["8", "8 meters"],
          testing_fact_unit_id: `fact_${sectionIndex}_0`
        }
      ]
    }
  });
}

/**
 * Calls the active AI provider endpoint with a system and user prompt.
 */
export async function callListeningAI(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const { providerId, apiKey, modelName } = resolveListeningProvider();

  // If no API key is set, fall back to mock response generation logic based on the user prompt
  if (!apiKey) {
    if (userPrompt.includes("StartSession")) {
      const matchLevel = userPrompt.match(/CEFR Level: (\w+)/);
      const matchCount = userPrompt.match(/Section Count: (\d+)/);
      const level = matchLevel ? matchLevel[1] : "B2";
      const count = matchCount ? parseInt(matchCount[1], 10) : 3;
      return getMockSection1Response(level, count);
    } else {
      const matchIndex = userPrompt.match(/Section Index: (\d+)/);
      const matchLevel = userPrompt.match(/CEFR Level: (\w+)/);
      const matchTopic = userPrompt.match(/Topic: ([^\n]+)/);
      const idx = matchIndex ? parseInt(matchIndex[1], 10) : 1;
      const level = matchLevel ? matchLevel[1] : "B2";
      const topic = matchTopic ? matchTopic[1].trim() : "";
      return getMockNextSectionResponse(idx, level, topic);
    }
  }

  if (providerId === "gemini") {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=` +
      encodeURIComponent(apiKey);

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini request failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  if (providerId === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Claude request failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    return data.content?.find((c) => c.type === "text")?.text ?? "";
  }

  if (providerId === "deepseek") {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`DeepSeek request failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "";
  }

  if (providerId === "minimax_m3" || providerId === "minimax") {
    const baseUrl = process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1";
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      throw new Error(`MiniMax request failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "";
  }

  throw new Error(`Unsupported provider: ${providerId}`);
}

/**
 * Builds the Phase 1, Phase 2, Phase 3 system prompt for Section 1 generation.
 */
export function buildSection1SystemPrompt(): string {
  return [
    "You are an expert AI English academic listening content designer for the Fonetik application.",
    "You must execute a strict Single-Call Three-Phase Reasoning Model:",
    "",
    "PHASE 1: ANALYSIS",
    "Analyze the learner's previous listening attempts history (if provided) to identify strengths and weaknesses. If no history is provided or is_placement is true, summarize that this is a new placement session.",
    "",
    "PHASE 2: PLANNING",
    "Plan the overall CEFR level, topic progression across sections, and distribution of question types. The plan must match the requested number of sections and average CEFR level. Ensure question types strictly focus on 'fill_blank'.",
    "",
    "PHASE 3: IMPLEMENTATION",
    "Generate the listening passage script (audio_script) for Section 1 (index 0). Extract a discrete array of key facts (fact_units) from the passage script. Finally, formulate the questions array. Each question must target a specific fact unit and map to it via testing_fact_unit_id.",
    "",
    "CRITICAL STRUCTURAL BRIDGE (FACT-UNITS BRIDGE):",
    "- You MUST write the complete passage audio_script first.",
    "- You MUST extract 2-4 discrete, clear factual statements (fact_units) from that audio_script.",
    "- You MUST formulate one question for each fact unit. Each question MUST test a key word or phrase from the script. You must associate each question with the correct fact_unit_id in the testing_fact_unit_id property.",
    "",
    "QUESTION FORMAT RULES:",
    "- The question type is 'fill_blank'.",
    "- The question_text MUST contain a single '[blank]' placeholder (e.g. 'Water boils at [blank] degrees.').",
    "- You must provide the primary correct 'answer' and a list of 'accepted_variants' (alternate spellings, numbers vs. words, etc.).",
    "",
    "RESPONSE FORMAT:",
    "You must respond with ONLY a single valid JSON object containing exactly the keys below. Do not wrap in markdown code blocks like ```json or add any extra text:",
    "{",
    '  "reasoning": {',
    '    "phase1_analysis": "your phase 1 findings here",',
    '    "phase2_planning": "your phase 2 outline here",',
    '    "phase3_implementation": "your phase 3 outline here"',
    "  },",
    '  "plan": {',
    '    "cefr_level": "A1-C2",',
    '    "section_count": 3,',
    '    "sections": [',
    '      { "section_index": 0, "cefr_level": "A1-C2", "topic": "topic name", "question_types": ["fill_blank"] }',
    "    ]",
    "  },",
    '  "section": {',
    '    "topic": "topic name",',
    '    "audio_script": "lecture text...",',
    '    "fact_units": [',
    '      { "id": "fact_0", "text": "fact statement" }',
    "    ],",
    '    "questions": [',
    '      { "id": "q_0", "question_type": "fill_blank", "question_text": "text containing [blank]", "answer": "correct_word", "accepted_variants": ["variant1"], "testing_fact_unit_id": "fact_0" }',
    "    ]",
    "  }",
    "}"
  ].join("\n");
}

/**
 * Builds the user prompt for Section 1 generation.
 */
export function buildSection1UserPrompt(
  cefrLevel: string,
  sectionCount: number,
  isPlacement: boolean,
  historySummary?: string
): string {
  return [
    "Generate Listening Exercise StartSession.",
    `Requested CEFR Level: ${cefrLevel}`,
    `Section Count: ${sectionCount}`,
    `Is Placement Session: ${isPlacement}`,
    historySummary ? `Previous Session History Summary:\n${historySummary}` : "No previous history available."
  ].join("\n");
}

/**
 * Builds the system prompt for subsequent sections (index >= 1) generation.
 */
export function buildNextSectionSystemPrompt(): string {
  return [
    "You are an expert AI English academic listening content designer for the Fonetik application.",
    "Your task is to generate the next section content based on the pre-approved session generation plan.",
    "",
    "You must execute Phase 3: Implementation for this section.",
    "",
    "CRITICAL STRUCTURAL BRIDGE (FACT-UNITS BRIDGE):",
    "- You MUST write the complete passage audio_script first.",
    "- You MUST extract 2-4 discrete, clear factual statements (fact_units) from that audio_script.",
    "- You MUST formulate one question for each fact unit. Each question MUST test a key word or phrase from the script. You must associate each question with the correct fact_unit_id in the testing_fact_unit_id property.",
    "",
    "QUESTION FORMAT RULES:",
    "- The question type is 'fill_blank'.",
    "- The question_text MUST contain a single '[blank]' placeholder.",
    "- You must provide the primary correct 'answer' and a list of 'accepted_variants'.",
    "",
    "RESPONSE FORMAT:",
    "You must respond with ONLY a single valid JSON object containing exactly the keys below. Do not wrap in markdown code blocks or add any extra text:",
    "{",
    '  "reasoning": {',
    '    "phase3_implementation": "your phase 3 details here"',
    "  },",
    '  "section": {',
    '    "topic": "topic name",',
    '    "audio_script": "lecture text...",',
    '    "fact_units": [',
    '      { "id": "fact_0", "text": "fact statement" }',
    "    ],",
    '    "questions": [',
    '      { "id": "q_0", "question_type": "fill_blank", "question_text": "text containing [blank]", "answer": "correct_word", "accepted_variants": ["variant1"], "testing_fact_unit_id": "fact_0" }',
    "    ]",
    "  }",
    "}"
  ].join("\n");
}

/**
 * Builds the user prompt for subsequent sections.
 */
export function buildNextSectionUserPrompt(
  sectionIndex: number,
  cefrLevel: string,
  topic: string,
  questionTypes: string[]
): string {
  return [
    "Generate next section content for the session.",
    `Section Index: ${sectionIndex}`,
    `CEFR Level: ${cefrLevel}`,
    `Topic: ${topic}`,
    `Question Types: ${questionTypes.join(", ")}`
  ].join("\n");
}
