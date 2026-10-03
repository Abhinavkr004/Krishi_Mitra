import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// Tried in order. If one is overloaded, the next one is used.
const MODELS = [
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generateText(prompt: string): Promise<string> {
  let lastError: any;
  for (const name of MODELS) {
    const model = genAI.getGenerativeModel({ model: name });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err: any) {
        lastError = err;
        console.error(
          `${name} attempt ${attempt + 1} failed:`,
          err?.status,
          err?.message,
        );
        const retryable = err?.status === 503 || err?.status === 429;
        if (!retryable) break; // e.g. bad model name -> go to next model
        await sleep(1000 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

export async function GET(request: NextRequest) {
  try {
    const crop = request.nextUrl.searchParams.get("crop");

    if (!crop) {
      return NextResponse.json(
        { error: "Crop parameter is required" },
        { status: 400 },
      );
    }

    const prompt = `You are an agricultural expert AI. Provide detailed information about electric consumption for ${crop} cultivation. Include the following in your response:

Electric Consumption:
- Estimate the electric consumption for various farming operations related to ${crop}.
- Provide data for a pie chart showing the distribution of electricity usage.

Format the electric consumption data as a JSON array that can be easily parsed for chart creation. Each item in the array should have a 'name' for the operation and a 'percentage' for its share of total electricity usage. For example:

[
  {"name": "Irrigation", "percentage": 40},
  {"name": "Climate Control", "percentage": 30},
  {"name": "Lighting", "percentage": 20},
  {"name": "Other", "percentage": 10}
]

Ensure the percentages add up to 100.`;

    const text = await generateText(prompt);

    // Extract the JSON data from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const electricConsumptionData = JSON.parse(jsonMatch[0]);
      return NextResponse.json(electricConsumptionData);
    } else {
      throw new Error("Failed to extract electric consumption data");
    }
  } catch (error) {
    console.error("Error generating electric consumption data:", error);
    return NextResponse.json(
      { error: "Failed to generate electric consumption data" },
      { status: 500 },
    );
  }
}
