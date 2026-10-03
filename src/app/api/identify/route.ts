import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL_NAME = "gemini-flash-latest";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const PROMPT =
  "Identify this plant and provide its name and some important information about it. 100 words or less. If the image does not show a plant, say so.";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getStatus(err: unknown): number | undefined {
  return (err as { status?: number })?.status;
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

    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(image.type)) {
      return NextResponse.json(
        { error: "Please upload a JPEG, PNG or WebP image." },
        { status: 400 },
      );
    }

    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image is too large. Please use an image under 4 MB." },
        { status: 413 },
      );
    }

    const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const parts = [
      PROMPT,
      { inlineData: { data: base64, mimeType: image.type } },
    ];

    let text: string;
    try {
      text = (await model.generateContent(parts)).response.text();
    } catch (err) {
      // Retry once, only for temporary overload (503). Never retry a 429:
      // it would just use up more of the quota.
      if (getStatus(err) !== 503) throw err;
      await sleep(1500);
      text = (await model.generateContent(parts)).response.text();
    }

    return NextResponse.json({ result: text });
  } catch (error) {
    console.error("Error identifying plant:", error);

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
      { error: "Failed to identify plant" },
      { status: 500 },
    );
  }
}
