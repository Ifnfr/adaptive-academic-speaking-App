
import { resolveFeatureProvider } from "../../../lib/ai-provider-resolver";

export interface AIProviderResponse {
  text: string;
}

export async function resolveListeningProvider(): Promise<{ providerId: string; apiKey: string; modelName: string }> {
  return resolveFeatureProvider("listening");
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
      phase2_planning: `Mock planning: session will proceed with 3 sections at CEFR level ${cefrLevel}.`,
      phase3_implementation: "Mock implementation: designing Section 1 content (Fill-in-the-blank)."
    },
    plan: {
      cefr_level: cefrLevel,
      section_count: 3,
      sections: [
        {
          section_index: 0,
          cefr_level: cefrLevel,
          topic: "Chemistry Basics",
          question_types: ["fill_blank"]
        },
        {
          section_index: 1,
          cefr_level: cefrLevel,
          topic: "Atmospheric Density",
          question_types: ["multiple_choice"]
        },
        {
          section_index: 2,
          cefr_level: cefrLevel,
          topic: "Water Properties",
          question_types: ["true_false"]
        }
      ]
    },
    section: {
      topic: "Chemistry Basics",
      audio_script: "Welcome to this chemistry lecture. Today we discuss water boiling points. Under standard sea-level atmospheric pressure, pure water always boils at exactly one hundred degrees Celsius. However, at higher altitudes where pressure is lower, water boils at lower temperatures. Oxygen and hydrogen bind together to form water molecules.",
      fact_units: [
        { id: "fact_0", text: "Under standard sea-level atmospheric pressure, pure water always boils at exactly 100 degrees Celsius." },
        { id: "fact_1", text: "At higher altitudes where pressure is lower, water boils at lower temperatures." },
        { id: "fact_2", text: "Water is composed of oxygen and hydrogen atoms." },
        { id: "fact_3", text: "Hydrogen is the lightest element on the periodic table." },
        { id: "fact_4", text: "Water molecules exhibit polarity due to unequal electron sharing." }
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
          question_text: "At higher altitudes where pressure is lower, water boils at [blank] temperatures.",
          answer: "lower",
          accepted_variants: ["colder"],
          testing_fact_unit_id: "fact_1"
        },
        {
          id: "q_2",
          question_type: "fill_blank",
          question_text: "Oxygen and [blank] bind together to form water molecules.",
          answer: "hydrogen",
          accepted_variants: ["H"],
          testing_fact_unit_id: "fact_2"
        },
        {
          id: "q_3",
          question_type: "fill_blank",
          question_text: "The lightest element on the periodic table is [blank].",
          answer: "hydrogen",
          accepted_variants: ["H"],
          testing_fact_unit_id: "fact_3"
        },
        {
          id: "q_4",
          question_type: "fill_blank",
          question_text: "Water molecules exhibit polarity due to unequal [blank] sharing.",
          answer: "electron",
          accepted_variants: ["electrons"],
          testing_fact_unit_id: "fact_4"
        }
      ]
    }
  });
}

/**
 * Generates mock response for subsequent sections
 */
export function getMockNextSectionResponse(sectionIndex: number, cefrLevel: string, topic: string): string {
  if (sectionIndex === 1) {
    return JSON.stringify({
      reasoning: {
        phase3_implementation: `Mock implementation: generating section 2 (Multiple Choice) content at level ${cefrLevel}.`
      },
      section: {
        topic: topic || "Atmospheric Density",
        audio_script: "Warm air expands and rises, while cold air contracts and sinks. Gravity pulls the air molecules closer to the surface, creating higher density. Air pressure is measured using an instrument called a barometer.",
        fact_units: [
          { id: "fact_1_0", text: "Warm air expands and rises." },
          { id: "fact_1_1", text: "Cold air contracts and sinks." },
          { id: "fact_1_2", text: "Gravity pulls air molecules closer to the Earth's surface." },
          { id: "fact_1_3", text: "A barometer is used to measure air pressure." },
          { id: "fact_1_4", text: "Air density is higher closer to the surface." }
        ],
        questions: [
          {
            id: "q_1_0",
            question_type: "multiple_choice",
            question_text: "What happens to warm air?",
            options: ["It contracts and sinks", "It expands and rises", "It remains stable", "It turns into liquid"],
            answer: "It expands and rises",
            testing_fact_unit_id: "fact_1_0"
          },
          {
            id: "q_1_1",
            question_type: "multiple_choice",
            question_text: "What does cold air do?",
            options: ["It expands and rises", "It contracts and sinks", "It evaporates", "It does not move"],
            answer: "It contracts and sinks",
            testing_fact_unit_id: "fact_1_1"
          },
          {
            id: "q_1_2",
            question_type: "multiple_choice",
            question_text: "What force pulls air molecules closer to the surface?",
            options: ["Friction", "Centrifugal force", "Gravity", "Magnetic force"],
            answer: "Gravity",
            testing_fact_unit_id: "fact_1_2"
          },
          {
            id: "q_1_3",
            question_type: "multiple_choice",
            question_text: "Which instrument is used to measure air pressure?",
            options: ["Thermometer", "Barometer", "Hygrometer", "Anemometer"],
            answer: "Barometer",
            testing_fact_unit_id: "fact_1_3"
          },
          {
            id: "q_1_4",
            question_type: "multiple_choice",
            question_text: "Where is air density higher?",
            options: ["Closer to the surface", "Higher in the atmosphere", "In outer space", "It is uniform everywhere"],
            answer: "Closer to the surface",
            testing_fact_unit_id: "fact_1_4"
          }
        ]
      }
    });
  } else {
    return JSON.stringify({
      reasoning: {
        phase3_implementation: `Mock implementation: generating section 3 (True/False) content at level ${cefrLevel}.`
      },
      section: {
        topic: topic || "Water Properties",
        audio_script: "Water has many unique features. It exists in three states of matter: solid, liquid, and gas. Liquid water is denser than solid ice, which is why ice floats. Water is also known as the universal solvent.",
        fact_units: [
          { id: "fact_2_0", text: "Water exists in three states of matter." },
          { id: "fact_2_1", text: "Ice floats on water because liquid water is denser than ice." },
          { id: "fact_2_2", text: "Water is known as the universal solvent." },
          { id: "fact_2_3", text: "Pure water is odorless and tasteless." },
          { id: "fact_2_4", text: "Water freezes at zero degrees Celsius." }
        ],
        questions: [
          {
            id: "q_2_0",
            question_type: "true_false",
            question_text: "Water exists in exactly two states of matter.",
            options: ["True", "False"],
            answer: "False",
            testing_fact_unit_id: "fact_2_0"
          },
          {
            id: "q_2_1",
            question_type: "true_false",
            question_text: "Ice floats on water because ice is denser than liquid water.",
            options: ["True", "False"],
            answer: "False",
            testing_fact_unit_id: "fact_2_1"
          },
          {
            id: "q_2_2",
            question_type: "true_false",
            question_text: "Water is commonly referred to as the universal solvent.",
            options: ["True", "False"],
            answer: "True",
            testing_fact_unit_id: "fact_2_2"
          },
          {
            id: "q_2_3",
            question_type: "true_false",
            question_text: "Pure water has a strong odor and sour taste.",
            options: ["True", "False"],
            answer: "False",
            testing_fact_unit_id: "fact_2_3"
          },
          {
            id: "q_2_4",
            question_type: "true_false",
            question_text: "Under standard conditions, pure water freezes at 0 degrees Celsius.",
            options: ["True", "False"],
            answer: "True",
            testing_fact_unit_id: "fact_2_4"
          }
        ]
      }
    });
  }
}

/**
 * Calls the active AI provider endpoint with a system and user prompt.
 */
export async function callListeningAI(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const { providerId, apiKey, modelName } = await resolveListeningProvider();

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
    "Plan the overall CEFR level and topic progression across exactly 3 sections. The plan must define a 3-phase session where:",
    "  - Section index 0 is always Fill-in-the-blank ('fill_blank').",
    "  - Section index 1 is always Multiple Choice ('multiple_choice').",
    "  - Section index 2 is always True/False ('true_false').",
    "The plan must match this exact layout. The CEFR level should match the requested average CEFR level.",
    "",
    "PHASE 3: IMPLEMENTATION",
    "Generate the listening passage script (audio_script) for Section 1 (index 0). Extract a discrete array of key facts (fact_units) from the passage script. Finally, formulate the questions array. Each question must target a specific fact unit and map to it via testing_fact_unit_id.",
    "The audio script must NOT use ordinal or sequential markers (e.g., 'first', 'second', 'third', 'finally', 'lastly', 'to begin with', 'next') to structure the passage. Information must flow naturally as connected prose or natural spoken discourse — not as a numbered list read aloud. The listener must not be able to infer the number or position of key facts from the script's structure.",
    "",
    "CRITICAL STRUCTURAL BRIDGE (FACT-UNITS BRIDGE):",
    "- You MUST write the complete passage audio_script first.",
    "- You MUST extract exactly 5 discrete, clear factual statements (fact_units) from that audio_script.",
    "- You must associate each question with the correct fact_unit_id in the testing_fact_unit_id property.",
    "",
    "CRITICAL RULE: You MUST generate exactly 5 questions. Do not generate fewer.",
    "",
    "FORMAT ENFORCEMENT: All 5 questions for this section (index 0) MUST be Fill-in-the-Blank ('fill_blank') format. Do not include any multiple choice or true/false questions in this section.",
    "",
    "DIFFICULTY SCALING: Analyze the user's past performance (if provided in context) or the target academic level. Increase vocabulary complexity and inferential reasoning requirements for each subsequent question.",
    "",
    "QUESTION FORMAT RULES:",
    "1. fill_blank:",
    "   - The question_text MUST contain a single '[blank]' placeholder (e.g., 'Standard sea-level pressure causes water to boil at [blank] degrees.').",
    "   - You must provide the primary correct 'answer' and a list of 'accepted_variants' (alternate spellings, numbers vs. words, etc.).",
    "2. true_false:",
    "   - The question_text MUST be a complete statement.",
    "   - The 'options' array MUST contain exactly ['True', 'False'].",
    "   - The 'answer' MUST be either 'True' or 'False'.",
    "3. multiple_choice:",
    "   - The question_text MUST be a clear question or incomplete statement.",
    "   - The 'options' array MUST contain exactly 4 distinct choices.",
    "   - The 'answer' MUST be the exact string of the correct choice from the options array.",
    "",
    "JSON ENFORCEMENT: Return strictly valid JSON matching the schema.",
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
    '      { "section_index": 0, "cefr_level": "A1-C2", "topic": "topic name 1", "question_types": ["fill_blank"] },',
    '      { "section_index": 1, "cefr_level": "A1-C2", "topic": "topic name 2", "question_types": ["multiple_choice"] },',
    '      { "section_index": 2, "cefr_level": "A1-C2", "topic": "topic name 3", "question_types": ["true_false"] }',
    '    ]',
    "  },",
    '  "section": {',
    '    "topic": "topic name 1",',
    '    "audio_script": "lecture text...",',
    '    "fact_units": [',
    '      { "id": "fact_0", "text": "fact statement 1" },',
    '      { "id": "fact_1", "text": "fact statement 2" },',
    '      { "id": "fact_2", "text": "fact statement 3" },',
    '      { "id": "fact_3", "text": "fact statement 4" },',
    '      { "id": "fact_4", "text": "fact statement 5" }',
    "    ],",
    '    "questions": [',
    '      { "id": "q_0", "question_type": "fill_blank", "question_text": "text containing [blank]", "answer": "correct_word", "accepted_variants": ["variant1"], "testing_fact_unit_id": "fact_0" },',
    '      { "id": "q_1", "question_type": "fill_blank", "question_text": "text containing [blank]", "answer": "correct_word", "accepted_variants": [], "testing_fact_unit_id": "fact_1" },',
    '      { "id": "q_2", "question_type": "fill_blank", "question_text": "text containing [blank]", "answer": "correct_word", "accepted_variants": [], "testing_fact_unit_id": "fact_2" },',
    '      { "id": "q_3", "question_type": "fill_blank", "question_text": "text containing [blank]", "answer": "word", "accepted_variants": [], "testing_fact_unit_id": "fact_3" },',
    '      { "id": "q_4", "question_type": "fill_blank", "question_text": "text containing [blank]", "answer": "word", "accepted_variants": [], "testing_fact_unit_id": "fact_4" }',
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
    historySummary ? `Previous Session History Summary:\n${historySummary}` : "No previous history available.",
    "Note on audio_script format: The audio script must NOT use ordinal or sequential markers (e.g., 'first', 'second', 'third', 'finally', 'lastly', 'to begin with', 'next') to structure the passage. Information must flow naturally as connected prose or natural spoken discourse — not as a numbered list read aloud. The listener must not be able to infer the number or position of key facts from the script's structure."
  ].join("\n");
}

/**
 * Builds the system prompt for subsequent sections (index >= 1) generation.
 */
export function buildNextSectionSystemPrompt(questionType: string): string {
  let questionsExample = "";
  if (questionType === "multiple_choice") {
    questionsExample = [
      '    "questions": [',
      '      { "id": "q_0", "question_type": "multiple_choice", "question_text": "example multiple choice question", "options": ["choice1", "choice2", "choice3", "choice4"], "answer": "choice1", "testing_fact_unit_id": "fact_0" },',
      '      { "id": "q_1", "question_type": "multiple_choice", "question_text": "another multiple choice question", "options": ["choice1", "choice2", "choice3", "choice4"], "answer": "choice2", "testing_fact_unit_id": "fact_1" }',
      '    ]'
    ].join("\n");
  } else if (questionType === "true_false") {
    questionsExample = [
      '    "questions": [',
      '      { "id": "q_0", "question_type": "true_false", "question_text": "example true statement.", "answer": "True", "testing_fact_unit_id": "fact_0" },',
      '      { "id": "q_1", "question_type": "true_false", "question_text": "example false statement.", "answer": "False", "testing_fact_unit_id": "fact_1" }',
      '    ]'
    ].join("\n");
  } else {
    // default/fill_blank
    questionsExample = [
      '    "questions": [',
      '      { "id": "q_0", "question_type": "fill_blank", "question_text": "example [blank] question.", "answer": "correct_word", "accepted_variants": ["variant1"], "testing_fact_unit_id": "fact_0" },',
      '      { "id": "q_1", "question_type": "fill_blank", "question_text": "another [blank] question.", "answer": "correct_word", "accepted_variants": [], "testing_fact_unit_id": "fact_1" }',
      '    ]'
    ].join("\n");
  }

  return [
    "You are an expert AI English academic listening content designer for the Fonetik application.",
    "Your task is to generate the next section content based on the pre-approved session generation plan.",
    "",
    "You must execute Phase 3: Implementation for this section.",
    "The audio script must NOT use ordinal or sequential markers (e.g., 'first', 'second', 'third', 'finally', 'lastly', 'to begin with', 'next') to structure the passage. Information must flow naturally as connected prose or natural spoken discourse — not as a numbered list read aloud. The listener must not be able to infer the number or position of key facts from the script's structure.",
    "",
    "CRITICAL STRUCTURAL BRIDGE (FACT-UNITS BRIDGE):",
    "- You MUST write the complete passage audio_script first.",
    "- You MUST extract exactly 5 discrete, clear factual statements (fact_units) from that audio_script.",
    "- You must associate each question with the correct fact_unit_id in the testing_fact_unit_id property.",
    "",
    "CRITICAL RULE: You MUST generate exactly 5 questions. Do not generate fewer.",
    "",
    "FORMAT ENFORCEMENT: You MUST generate ALL 5 questions matching the EXACT single question format specified in the user prompt. Do not mix question formats.",
    "  - If the requested question type is 'fill_blank', all 5 questions must be 'fill_blank'.",
    "  - If the requested question type is 'multiple_choice', all 5 questions must be 'multiple_choice'.",
    "  - If the requested question type is 'true_false', all 5 questions must be 'true_false'.",
    "",
    "DIFFICULTY SCALING: Analyze the user's past performance (if provided in context) or the target academic level. Increase vocabulary complexity and inferential reasoning requirements for each subsequent question.",
    "",
    "QUESTION FORMAT RULES:",
    "1. fill_blank:",
    "   - The question_text MUST contain a single '[blank]' placeholder (e.g., 'Standard sea-level pressure causes water to boil at [blank] degrees.').",
    "   - You must provide the primary correct 'answer' and a list of 'accepted_variants' (alternate spellings, numbers vs. words, etc.).",
    "2. true_false:",
    "   - The question_text MUST be a complete statement.",
    "   - The 'options' array MUST contain exactly ['True', 'False'].",
    "   - The 'answer' MUST be either 'True' or 'False'.",
    "3. multiple_choice:",
    "   - The question_text MUST be a clear question or incomplete statement.",
    "   - The 'options' array MUST contain exactly 4 distinct choices.",
    "   - The 'answer' MUST be the exact string of the correct choice from the options array.",
    "",
    "JSON ENFORCEMENT: Return strictly valid JSON matching the schema.",
    "{",
    '  "reasoning": {',
    '    "phase3_implementation": "your phase 3 details here"',
    "  },",
    '  "section": {',
    '    "topic": "topic name",',
    '    "audio_script": "lecture text...",',
    '    "fact_units": [',
    '      { "id": "fact_0", "text": "fact statement 1" },',
    '      { "id": "fact_1", "text": "fact statement 2" },',
    '      { "id": "fact_2", "text": "fact statement 3" },',
    '      { "id": "fact_3", "text": "fact statement 4" },',
    '      { "id": "fact_4", "text": "fact statement 5" }',
    "    ],",
    questionsExample,
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
    `Question Types: ${questionTypes.join(", ")}`,
    "Note on audio_script format: The audio script must NOT use ordinal or sequential markers (e.g., 'first', 'second', 'third', 'finally', 'lastly', 'to begin with', 'next') to structure the passage. Information must flow naturally as connected prose or natural spoken discourse — not as a numbered list read aloud. The listener must not be able to infer the number or position of key facts from the script's structure."
  ].join("\n");
}
