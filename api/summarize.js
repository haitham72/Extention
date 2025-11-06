// api/summarize.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // tighten if you want
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
    res.setHeader("Access-Control-Allow-Methods", corsHeaders["Access-Control-Allow-Methods"]);
    res.setHeader("Access-Control-Allow-Headers", corsHeaders["Access-Control-Allow-Headers"]);
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { transcript, summary_type = "insights" } = req.body || {};
    if (!transcript) {
      res.setHeader("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
      return res.status(400).json({ error: "No transcript provided" });
    }

    let prompt;
    if (summary_type === "insights") {
      prompt = "You are a YouTube summarizer. Generate a single, concise paragraph (under 20 words) summarizing this transcript. The main idea to look for is how valuable is this video; is it clickbait or superb value of user's time.\n\nTranscript: ";
    } else if (summary_type === "concise") {
      prompt = "You are a YouTube summarizer. Generate a maximum of five concise bullet points (key insights) of the key insights from this transcript. Use emojis at the start of each point. Focus on main ideas.\n\nTranscript: ";
    } else if (summary_type === "detailed") {
      prompt = "You are a YouTube summarizer. Generate a detailed, multi-paragraph summary (under 450 words) of this transcript, use proper structure and bullet points covering all main topics and supporting details.\n\nTranscript: ";
    } else {
      res.setHeader("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
      return res.status(400).json({ error: "Invalid summary_type" });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      res.setHeader("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
      return res.status(500).json({ error: "Missing GOOGLE_API_KEY" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt + transcript);
    const text = result?.response?.text?.() || result?.response?.text || result?.text || "";

    res.setHeader("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
    return res.status(200).json({ summary: text });
  } catch (e) {
    res.setHeader("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
    return res.status(400).json({ error: e?.message || "Summarization failed" });
  }
}