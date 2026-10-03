import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL_NAME = "gemini-flash-latest"; // same model your /api/recommend route uses
const MAX_ATTEMPTS = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // ~4 MB decoded size

const PROMPT = `You are an expert soil scientist with over 15 years of experience analyzing soil images.
Analyze the soil in the attached image and give a clear, well-organized answer covering:

1. Soil texture (sandy, loamy, clayey, etc.) and color, including any visible features such as moisture, organic matter, or cracking.
2. Crops that are likely to thrive in this soil.
3. Practical ways to improve soil health for better yields.

Base your answer only on what is visible in the image. If the image does not clearly show soil, say so.`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getStatus(err: unknown): number | undefined {
  return (err as { status?: number })?.status;
}

async function generateWithRetry(
  genAI: GoogleGenerativeAI,
  parts: Parameters<
    ReturnType<GoogleGenerativeAI["getGenerativeModel"]>["generateContent"]
  >[0],
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await model.generateContent(parts);
      return result.response.text();
    } catch (err) {
      lastError = err;
      const status = getStatus(err);
      const retryable = status === 503 || status === 429 || status === 500;

      if (!retryable || attempt === MAX_ATTEMPTS) throw err;

      await sleep(1000 * 2 ** (attempt - 1)); // 1s, then 2s
    }
  }

  throw lastError;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error("GOOGLE_API_KEY is not set");
      return NextResponse.json(
        { error: "Server is not configured correctly." },
        { status: 500 },
      );
    }

    let body: { image?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const image = body.image;
    const match =
      typeof image === "string"
        ? image.match(
            /^data:(image\/(?:jpeg|png|webp|heic|heif));base64,([A-Za-z0-9+/=\r\n]+)$/,
          )
        : null;

    if (!match) {
      return NextResponse.json(
        {
          error:
            "Please provide a JPEG, PNG or WebP image as a base64 data URL.",
        },
        { status: 400 },
      );
    }

    const [, mimeType, data] = match;

    // Approximate decoded size from the base64 length
    const approxBytes = Math.floor((data.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image is too large. Please use an image under 4 MB." },
        { status: 413 },
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const analysis = await generateWithRetry(genAI, [
      PROMPT,
      { inlineData: { mimeType, data } },
    ]);

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Error analyzing soil:", error);

    const status = getStatus(error);
    if (status === 503 || status === 429) {
      return NextResponse.json(
        {
          error:
            "The AI service is busy right now. Please try again in a moment.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Error analyzing soil" },
      { status: 500 },
    );
  }
}
