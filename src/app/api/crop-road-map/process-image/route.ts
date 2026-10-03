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

const PROMPT = `Analyze this crop image and generate a detailed roadmap for growing this crop.
Include soil preparation, planting, care instructions, pest management, and harvesting.
Format the roadmap as simple HTML (headings, paragraphs, lists) for easy display.
Return only the HTML content, without <html> or <body> tags and without code fences.
If the image does not show a crop or plant, say so.`;

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
      // Retry once for temporary overload only. Never retry a 429.
      if (getStatus(err) !== 503) throw err;
      await sleep(1500);
      text = (await model.generateContent(parts)).response.text();
    }

    return NextResponse.json({ result: stripCodeFences(text) });
  } catch (error) {
    console.error("Error processing crop image:", error);

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
      { error: "Failed to generate roadmap from image" },
      { status: 500 },
    );
  }
}
