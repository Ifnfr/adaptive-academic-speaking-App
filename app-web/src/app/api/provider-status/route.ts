import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = {
      claude: !!process.env.CLAUDE_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      deepseek: !!process.env.DEEPSEEK_API_KEY,
    };
    
    return NextResponse.json(status);
  } catch (error) {
    console.error("Error checking provider status:", error);
    return NextResponse.json(
      { error: "Failed to check provider status" },
      { status: 500 }
    );
  }
}
