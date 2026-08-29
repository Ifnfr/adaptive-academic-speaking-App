import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POST } from "../src/app/api/article-practice/route";

function validEssayQuestions() {
  return [
    {
      id: "q1",
      question: "What is the main idea?",
      expectedFocus: "Summarize the central argument.",
      targetSkill: "main_idea",
      suggestedWordCount: { min: 50, max: 120 },
    },
    {
      id: "q2",
      question: "Which detail supports it?",
      expectedFocus: "Use a specific detail.",
      targetSkill: "supporting_detail",
      suggestedWordCount: { min: 50, max: 120 },
    },
  ];
}

function mockFetchForDeepSeek(capture: { body?: unknown }) {
  process.env.DEEPSEEK_API_KEY = "test-key";
  process.env.ARTICLE_DEEPSEEK_MODEL = "deepseek-v4-flash-vision-exp";
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    if (init?.body) {
      try {
        capture.body = JSON.parse(init.body);
      } catch {
        // ignore non-json
      }
    }
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                sourceTitle: "Uploaded Document",
                sourceUrl: "uploaded-document",
                sourceDomain: "Uploaded Document",
                articleBrief: "Brief summary.",
                mainIdea: "Main idea.",
                keyPoints: ["Point 1", "Point 2"],
                usefulVocabulary: [
                  { word: "synthesize", meaning: "combine", whyUseful: "academic" },
                ],
                comprehensionChecks: ["Check 1"],
                essayQuestions: validEssayQuestions(),
                speakingTask: {
                  title: "Speaking title",
                  instruction: "Speaking instruction",
                  timeLimitSeconds: 120,
                  targetStructure: ["Structure 1"],
                },
                followUpQuestions: ["Follow up 1"],
                warnings: [],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
}

function buildFileRequest(fileName: string, fileData: string) {
  return new Request("http://localhost/api/article-practice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "DeepSeek",
      inputMode: "file",
      fileName,
      fileData,
      level: "Intermediate",
      mode: "Speaking",
      focus: "Coherence",
    }),
  });
}

const FIXTURE_DIR = join(__dirname, "fixtures");

test.describe("Article Practice — document upload (file mode)", () => {
  test("accepts a .pdf and returns structured practice (text extracted, images ignored)", async () => {
    const pdf = readFileSync(join(FIXTURE_DIR, "sample.pdf"));
    const capture: { body?: any } = {};
    mockFetchForDeepSeek(capture);
    const res = await POST(buildFileRequest("sample.pdf", pdf.toString("base64")));
    if (res.status !== 200) {
      const ej = await res.json();
      console.log("PDF_ERROR_BODY:", JSON.stringify(ej));
    }
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mainIdea).toBeTruthy();
    expect(Array.isArray(json.keyPoints)).toBe(true);
    // The uploaded text must have been sent to the AI (proves parseDocument ran)
    const userContent = capture.body?.messages?.find((m: any) => m.role === "user")?.content;
    expect(userContent).toContain("Just-in-Time Type Specialization");
  });

  test("accepts a .docx and returns structured practice", async () => {
    const docx = readFileSync(join(FIXTURE_DIR, "sample.docx"));
    const capture: { body?: any } = {};
    mockFetchForDeepSeek(capture);
    const res = await POST(buildFileRequest("sample.docx", docx.toString("base64")));
    if (res.status !== 200) {
      const ej = await res.json();
      console.log("DOCX_ERROR_BODY:", JSON.stringify(ej));
    }
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mainIdea).toBeTruthy();
    const userContent = capture.body?.messages?.find((m: any) => m.role === "user")?.content;
    expect(userContent).toContain("Just-in-Time Type Specialization");
  });

  test("rejects unsupported format with a 400 error", async () => {
    const txt = Buffer.from("just plain text");
    const res = await POST(buildFileRequest("notes.txt", txt.toString("base64")));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/format|didukung|unsupported/i);
  });

  test("rejects oversized file (base64 exceeds 3 MB cap)", async () => {
    const big = Buffer.alloc(3_200_000, 1); // 3.2 MB > 3 MB limit
    const res = await POST(buildFileRequest("big.pdf", big.toString("base64")));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/too large|3 MB/i);
  });
});
