import { NextRequest, NextResponse } from "next/server";
import { Mistral } from "@mistralai/mistralai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { base64Image, mimeType } = await req.json();

  const apiKey = "EUiuofpEeKu8N8uvTlYAvRY3a7LP1Yhn";
  const model = "mistral-small-latest"; // Mistral 3B, update if needed

  try {
    console.log("[OCR API] Received image for recognition");
    console.log("[OCR API] Image size (base64 chars):", base64Image?.length);
    console.log("[OCR API] mimeType:", mimeType);
    const client = new Mistral({ apiKey });
    const imageUrl = `data:${mimeType || "image/jpeg"};base64,${base64Image}`;
    const chatResponse = await client.chat.complete({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Recognize to-do list in the image, add each task on the image into the task list in the webpage. Return only the list of tasks, one per line, no extra explanation." },
            { type: "image_url", imageUrl },
          ],
        },
      ],
    });
    console.log("[OCR API] Mistral response:", JSON.stringify(chatResponse));
    const content = chatResponse.choices?.[0]?.message?.content || "";
    return NextResponse.json({ content });
  } catch (error: any) {
    console.error("[OCR API] Mistral API error:", error);
    return NextResponse.json({ error: error.message || "Failed to process image" }, { status: 500 });
  }
} 