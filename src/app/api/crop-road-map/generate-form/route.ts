import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL_NAME = "gemini-flash-latest";

const REQUIRED_FIELDS = [
  "cropType",
  "region",
  "soilType",
  "season",
  "sowingDate",
  "expectedHarvestDate",
] as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getStatus(err: unknown): number | undefined {
  return (err as { status?: number })?.status;
}

// Gemini often wraps HTML in ```html fences; remove them
function stripCodeFences(text: string): string {
  return text
    .replace(/^\s*```(?:html)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error("GOOGLE_API_KEY is not set");
      return NextResponse.json(
        { error: "Server is not configured correctly." },
        { status: 500 },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const missing = REQUIRED_FIELDS.filter((field) => !body[field]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Please fill out all required fields." },
        { status: 400 },
      );
    }

    const details = REQUIRED_FIELDS.map(
      (field) => `${field}: ${String(body[field])}`,
    ).join("\n");

    const prompt = `Generate a detailed crop roadmap based on the following information:
${details}

Include these sections:
1. Pre-planting preparations
2. Planting process
3. Growth stages and care instructions
4. Pest and disease management
5. Irrigation and fertilization schedule
6. Harvest preparation and timing
7. Post-harvest handling and storage

Format the roadmap as simple HTML (headings, paragraphs, lists) for easy display.
Return only the HTML content, without <html> or <body> tags and without code fences.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    let text: string;
    try {
      text = (await model.generateContent(prompt)).response.text();
    } catch (err) {
      // Retry once for temporary overload only. Never retry a 429.
      if (getStatus(err) !== 503) throw err;
      await sleep(1500);
      text = (await model.generateContent(prompt)).response.text();
    }

    return NextResponse.json({ result: stripCodeFences(text) });
  } catch (error) {
    console.error("Error generating roadmap:", error);

    const status = getStatus(error);
    if (status === 429) {
      return NextResponse.json(
        { error: "Rate limit reached. Please wait a minute and try again." },
        { status: 429 },
      );
    }
    if (status === 503) {
      return NextResponse.json(
        {
          error: "The AI service is busy right now. Please try again shortly.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Failed to generate roadmap. Please try again later." },
      { status: 500 },
    );
  }
}
