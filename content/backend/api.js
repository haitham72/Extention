// content/backend/api.js

import { extractChapters } from "../extraction/chapters.js";
import { extractDescription } from "../extraction/description.js";
const BACKEND_URL = "http://127.0.0.1:5000";

// FIX: 'sendToBackend' now accepts metadata as an argument
export const sendToBackend = async (videoId, transcriptData, metadata) => {
  try {
    console.log("Preparing data for backend...");

    // Extraction (Chapters and Description)
    const chapters = await extractChapters();
    const description = await extractDescription();

    // --- JSON Payload (FIXED TITLE ACCESS) ---
    const fullData = {
      video_id: videoId,
      // FIX: Use the 'metadata' object that was passed in
      video_title: metadata?.title || videoId,

      metadata: metadata, // Send the full metadata object
      description: description,
      chapters: chapters,
      transcript_structured: transcriptData.array,
      extraction_timestamp: new Date().toISOString(),
    };

    console.log("Sending data to backend...");
    const response = await fetch(`${BACKEND_URL}/store-video-data`, {
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
};

export const getTranscriptFromAPI = async (videoId) => {
  const url = `${BACKEND_URL}/transcript?video_id=${videoId}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `API request failed with status ${response.status}`
    );
  }
  const data = await response.json();
  return data.transcript; // This is the plain text with timestamps
};

export const getSummaryFromAPI = async (transcript, summaryType) => {
  const url = `${BACKEND_URL}/summarize`;
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
