// content/backend/api.js (Final Client-Only API)

// Note: No imports are needed if extractChapters/extractDescription were only used by sendToBackend.
// If your other files import them, they are defined in their own files.
const BACKEND_URL = "http://127.0.0.1:5000"; // Update this with your Vercel URL after deployment!

// Removed: sendToBackend
// Removed: getTranscriptFromAPI

export const getSummaryFromAPI = async (transcript, summaryType, videoId) => {
  const url = `${BACKEND_URL}/summarize`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript,
      summary_type: summaryType,
      video_id: videoId,
    }), // Added videoId for backend logging
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `API request failed with status ${response.status}`
    );
  }
  const data = await response.json();
  return data.summary;
};
