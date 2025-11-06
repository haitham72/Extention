// content/moduleEntryPoint.js

import * as Extraction from "./extraction/transcript.js";
import * as Metadata from "./extraction/metadata.js";
import {
  sendToBackend,
  getSummaryFromAPI,
} from "./backend/api.js";
import { initializeUI, showSummary, showTranscript } from "./ui/components.js";
import { setupEventListeners } from "./ui/events.js";

const ROOT_ID = "yt-summarizer-root";
const INJECTION_TARGET_ID = "#secondary";

// --- Global State & Cache ---
let currentVideoId = null;
let cachedTranscriptArray = null; // Stores the structured array format
let cachedTranscriptText = null; // Stores the plain text with timestamps
let cachedMetadata = null; // Stores the video metadata
let cachedSummaries = {};
let isSummarizing = false;
let isExtracting = false;

// Helper to convert the API's raw text into the structured array
function extractTranscriptArrayFromText(transcriptText) {
  if (!transcriptText) return [];
  const lines = transcriptText.split("\n");
  return lines
    .map((line) => {
      const match = line.match(
        /^\\[?(\\d{1,2}:\\d{2}(?::\\d{2})?)\\]?\\s+(.+)$/
      );
      if (match) {
        return { [match[1]]: match[2] };
      }
      return null;
    })
    .filter(Boolean);
}

// Main transcript getter
async function getTranscript(videoId, forceAPI = false) {
  if (isExtracting)
    return { array: cachedTranscriptArray, text: cachedTranscriptText };

  if (cachedTranscriptArray && !forceAPI) {
    console.log("Using cached transcript");
    return { array: cachedTranscriptArray, text: cachedTranscriptText };
  }

  isExtracting = true;
  document.getElementById("loading").hidden = false;
  document.getElementById("error").hidden = true;

  try {
    let transcriptData = { array: null, text: null };

    // 1. Attempt client-side extraction
    try {
      transcriptData = await Extraction.extractTranscriptClientSide(videoId);
    } catch (clientError) {
      console.warn(
        "Client-side extraction failed:",
        clientError.message
      );
    }

    // 2. If client-side fails (or returns empty), show error — no backend fallback
    if (
      !transcriptData ||
      !transcriptData.array ||
      transcriptData.array.length === 0
    ) {
      throw new Error("No transcript available (client-side extraction failed).");
    }

    // 3. Set cache and optionally send to backend storage
    cachedTranscriptArray = transcriptData.array;
    cachedTranscriptText = transcriptData.text;

    // Optional: disable server storage on Vercel for now
    const ENABLE_SERVER_STORAGE = false;
    if (ENABLE_SERVER_STORAGE) {
      sendToBackend(videoId, transcriptData, cachedMetadata).catch((e) =>
        console.warn("Background sendToBackend failed:", e)
      );
    }

    return transcriptData;
  } catch (e) {
    console.error("getTranscript error:", e);
    document.getElementById("error").textContent =
      e.message || "Failed to get transcript.";
    document.getElementById("error").hidden = false;
    return { array: null, text: null };
  } finally {
    isExtracting = false;
    document.getElementById("loading").hidden = true;
  }
}
async function generateSummary(summaryType) {
  if (isSummarizing) return;

  // Ensure we have transcript text to summarize
  if (!cachedTranscriptText) {
    console.log("Waiting for transcript to summarize...");
    // Await the full transcript data object
    const transcriptData = await getTranscript(currentVideoId);
    if (!transcriptData || !transcriptData.text) {
      console.error("Cannot summarize, transcript text is unavailable.");
      return;
    }
    // getTranscript will have set cachedTranscriptText globally
  }

  isSummarizing = true;
  document.getElementById("loading").hidden = false;
  document.getElementById("error").hidden = true;

  try {
    if (cachedSummaries[summaryType]) {
      showSummary(cachedSummaries[summaryType]);
      return;
    }

    const summary = await getSummaryFromAPI(cachedTranscriptText, summaryType);
    cachedSummaries[summaryType] = summary;
    showSummary(summary);
  } catch (e) {
    console.error("generateSummary error:", e);
    document.getElementById("error").textContent = e.message;
    document.getElementById("error").hidden = false;
  } finally {
    isSummarizing = false;
    document.getElementById("loading").hidden = true;
  }
}

// --- Initialization & Event Listeners ---
async function initializeSummarizer(videoId) {
  console.log("Initializing summarizer for video:", videoId);
  currentVideoId = videoId;
  cachedTranscriptArray = null;
  cachedTranscriptText = null;
  cachedMetadata = null;
  cachedSummaries = {};
  isSummarizing = false;
  isExtracting = false;

  const targetElement = await waitForElement(INJECTION_TARGET_ID);
  if (!targetElement) {
    console.error("Could not find injection target.");
    return;
  }

  let container = document.getElementById(ROOT_ID);
  if (container) container.remove();

  container = document.createElement("div");
  container.id = ROOT_ID;
  targetElement.prepend(container);

  try {
    const uiHtml = await fetch(chrome.runtime.getURL("ui.html")).then((r) =>
      r.text()
    );
    container.innerHTML = uiHtml;

    // FIX: Load metadata here and store it in the global 'cachedMetadata'
    cachedMetadata = await Metadata.extractMetadata();

    initializeUI(container); // This will now correctly detect dark mode

    // Pass functions to event listeners
    setupEventListeners(
      container,
      currentVideoId,
      cachedMetadata, // Pass the loaded metadata
      getTranscript,
      generateSummary,
      showTranscript
    );
  } catch (e) {
    console.error("Failed to load ui.html:", e);
    container.innerHTML =
      '<p style="color: red;">Error: Could not load UI.</p>';
  }
}

function waitForElement(selector) {
  return new Promise((resolve) => {
    if (document.querySelector(selector))
      return resolve(document.querySelector(selector));

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

function extractVideoId(url) {
  try {
    const urlObj = new URL(url);
    const videoId = urlObj.searchParams.get("v");
    if (videoId) return videoId;
    if (urlObj.hostname === "youtu.be") return urlObj.pathname.slice(1);
    return null;
  } catch (e) {
    return null;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "YOUTUBE_URL_CHANGED") {
    initializeSummarizer(request.videoId);
    sendResponse({ status: "received" });
  }
  return true;
});

const initialVideoId = extractVideoId(window.location.href);
if (initialVideoId) {
  initializeSummarizer(initialVideoId);
}
