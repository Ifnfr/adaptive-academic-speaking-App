import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const isPollyConfigured = !!(
      process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim() &&
      process.env.AWS_REGION?.trim()
    );
    const isElevenLabsConfigured = !!(
      process.env.ELEVENLABS_API_KEY?.trim() &&
      process.env.ELEVENLABS_VOICE_ID?.trim()
    );

    const status = {
      providers: {
        Claude: { configured: !!process.env.CLAUDE_API_KEY?.trim() },
        Gemini: { configured: !!process.env.GEMINI_API_KEY?.trim() },
        DeepSeek: { configured: !!process.env.DEEPSEEK_API_KEY?.trim() },
      },
      ttsProviders: {
        Polly: { configured: isPollyConfigured },
        ElevenLabs: { configured: isElevenLabsConfigured },
      },
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error("Error checking provider status:", error);
    return NextResponse.json(
      { error: "Failed to check provider status" },
      { status: 500 },
    );
  }
}
