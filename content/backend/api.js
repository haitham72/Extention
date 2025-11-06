// content/backend/api.js

import { extractChapters } from "../extraction/chapters.js";
import { extractDescription } from "../extraction/description.js";
const BACKEND_URL = "https://extention-dusky.vercel.app";

export const sendToBackend = async (videoId, transcriptData, metadata) => {
  try {
    console.log("Preparing data for backend...");

    const chapters = await extractChapters();
    const description = await extractDescription();

    const fullData = {
      video_id: videoId,
      video_title: metadata?.title || videoId,
      metadata,
      description,
      chapters,
      transcript_structured: transcriptData.array,
      extraction_timestamp: new Date().toISOString(),
    };

    console.log("Sending data to backend...");
    const response = await fetch(`${BACKEND_URL}/api/store-video-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fullData),
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      console.log("✅ Data sent to backend successfully");
    } else {
      console.warn("⚠️ Backend storage failed:", response.status);
    }
  } catch (e) {
    console.warn("Could not send to backend:", e.message || e);
  }
}

export const getSummaryFromAPI = async (transcript, summaryType) => {
  const url = `${BACKEND_URL}/api/summarize`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, summary_type: summaryType }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Summary request failed with status ${response.status}`
    );
  }
  const data = await response.json();
  return data.summary;
};
