import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// Try these in order if one is overloaded
const MODELS = [
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generateWithRetry(prompt: string) {
  let lastError: any;
  for (const name of MODELS) {
    const model = genAI.getGenerativeModel({ model: name });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err: any) {
        lastError = err;
        const retryable = err?.status === 503 || err?.status === 429;
        console.error(
          `${name} attempt ${attempt + 1} failed:`,
          err?.status,
          err?.message,
        );
        if (!retryable) break; // e.g. 404 bad model -> go to next model
        await sleep(1000 * (attempt + 1)); // 1s, 2s
      }
    }
  }
  throw lastError;
}

export async function POST(request: NextRequest) {
  try {
    const { cropData } = await request.json();
    const lang = "english";

    console.log("Crop:", cropData);
    console.log("Language:", lang);

    const prompt = `You are an agricultural expert AI. Provide detailed information about the following crop: ${cropData}.
The response language must be ${lang}.

Use EXACTLY these section headers, each on its own line starting with ### (keep the numbers and wording as written), and put the content below each header:

### 1. Best Conditions for Crop:
Describe ideal soil, temperature, and humidity conditions.

### 2. Current Price in Market:
Provide the latest average market price per unit (specify the unit).

### 3. Best Weather:
Describe the optimal weather conditions for growing this crop.

### 4. pH Level:
Specify the ideal soil pH range for this crop.

### 5. Tips to Protect:
List 3-5 key tips to protect the crop from common pests and diseases, one per line.

### 6. Water Consumption:
Provide average water requirements in liters per day or week, with a short note on water needs at different growth stages.

### 7. Electric Consumption:
If applicable, estimate the electric consumption for various farming operations, with a short note on how usage is distributed.

### 8. Best Places to Grow in India:
List the top 3-5 regions in India known for cultivating this crop.

### 9. AI Generated Tips:
Provide 3-5 innovative tips for improving yield or sustainability, one per line.

### 10. Top Consumers:
List the top 5 countries or regions that consume this crop.

### 11. Percentage of Risk:
Estimate the overall risk percentage for cultivating this crop, considering market volatility, weather dependence, and pest susceptibility. Start with the number, for example "35%", then one short sentence of explanation.

### 12. Blog Cards:
Generate 3 blog post ideas related to this crop, each with a title and a brief 2-3 sentence description.

Do not add any JSON or code blocks. Do not add any text before the first header.`;

    const text = await generateWithRetry(prompt);
    return NextResponse.json({ recommendation: text });
  } catch (error: any) {
    console.error("Error generating crop data:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate crop data" },
      { status: error?.status === 503 ? 503 : 500 },
    );
  }
}
