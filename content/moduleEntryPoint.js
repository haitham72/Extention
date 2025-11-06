// content/moduleEntryPoint.js

import * as Extraction from "./extraction/transcript.js";
import * as Metadata from "./extraction/metadata.js";
// REMOVED: sendToBackend, getTranscriptFromAPI
import { getSummaryFromAPI } from "./backend/api.js";
import { initializeUI, showSummary, showTranscript } from "./ui/components.js";
import { setupEventListeners } from "./ui/events.js";

const BACKEND_URL = "http://127.0.0.1:5000"; // *** IMPORTANT: UPDATE THIS TO YOUR VERSEL URL AFTER DEPLOYMENT ***
const ROOT_ID = "yt-summarizer-root";
const INJECTION_TARGET_ID = "#secondary"; // Target element for YouTube UI injection

// --- Global State & Cache Declarations ---
let currentVideoId = null;
let cachedTranscript = null; // Stores the structured array format
let cachedTranscriptText = null; // Stores the plain text with timestamps
let cachedMetadata = null;
let cachedSummaries = {};
let isSummarizing = false;
let isExtracting = false;

// Main transcript getter: ONLY attempts client-side extraction.
async function getTranscript(videoId) {
  if (isExtracting) {
    console.log("Extraction already in progress");
    return cachedTranscript || null;
  }
  // 1. CHECK LOCAL CACHE (Fastest)
  if (cachedTranscript) {
    console.log("Using locally cached transcript (in memory)");
    return cachedTranscript;
  }

  isExtracting = true;
  const loadingEl = document.getElementById("loading");
  const errorEl = document.getElementById("error");

  if (loadingEl) loadingEl.hidden = false;
  if (errorEl) errorEl.hidden = true;

  try {
    // 2. ATTEMPT CLIENT-SIDE SCRAPE (The ONLY way to get the transcript)
    console.log("Attempting client-side scrape...");
    const transcriptData = await Extraction.extractTranscriptClientSide(
      videoId
    );

    // Scrape Success!
    cachedTranscript = transcriptData.array;
    cachedTranscriptText = transcriptData.text;
    console.log("Client-side scrape SUCCESSFUL.");

    // REMOVED: All backend saving logic (sendToBackend)

    return cachedTranscript;
  } catch (e) {
    // If client-side scrape fails, the entire process fails here.
    console.error("getTranscript error (Client-Side Failed):", e);
    showError(e.message, true); // Show error and retry button
    return null;
  } finally {
    isExtracting = false;
    const loadingEl2 = document.getElementById("loading");
    if (loadingEl2) loadingEl2.hidden = true;
  }
}

async function generateSummary(summaryType = "concise") {
  if (isSummarizing) {
    console.log("Summarization already in progress");
    return;
  }
  if (cachedSummaries[summaryType]) {
    console.log(`Using cached ${summaryType} summary`);
    showSummary(cachedSummaries[summaryType]);
    return;
  }

  const transcriptArray = await getTranscript(currentVideoId);
  if (!transcriptArray || !cachedTranscriptText) {
    console.warn("Cannot summarize: Transcript not available.");
    return;
  }

  isSummarizing = true;
  const loadingEl = document.getElementById("loading");
  const summaryContent = document.getElementById("summary-content");
  if (loadingEl) loadingEl.hidden = false;
  summaryContent.innerHTML = `Generating ${summaryType} summary...`;

  try {
    const summary = await getSummaryFromAPI(
      cachedTranscriptText,
      summaryType,
      currentVideoId
    );
    cachedSummaries[summaryType] = summary;
    showSummary(summary);
  } catch (e) {
    console.error(`Error generating ${summaryType} summary:`, e);
    showError(`Error: ${e.message}`, false);
  } finally {
    isSummarizing = false;
    const loadingEl2 = document.getElementById("loading");
    if (loadingEl2) loadingEl2.hidden = true;
  }
}

function showError(message, showRetry) {
  const errorEl = document.getElementById("error");
  const errorTextEl = document.getElementById("error-text");
  const retryBtn = document.getElementById("retry-extract-btn");

  if (errorEl) {
    errorTextEl.textContent = message;
    if (retryBtn) retryBtn.hidden = !showRetry;
    errorEl.hidden = false;
    document.getElementById("loading").hidden = true;
    document.getElementById("initial-view").hidden = true;
    document.getElementById("summary-view").hidden = true;
  }
}

async function initializeSummarizer(videoId) {
  currentVideoId = videoId;
  // Reset Caches and UI
  cachedTranscript = null;
  cachedTranscriptText = null;
  cachedMetadata = null;
  cachedSummaries = {};
  isSummarizing = false;
  isExtracting = false;

  let container = document.getElementById(ROOT_ID);
  if (!container) {
    // Inject UI once
    container = document.createElement("div");
    container.id = ROOT_ID;

    // Fetch UI HTML content (assuming ui.html is accessible via Chrome extension APIs)
    const url = chrome.runtime.getURL("ui.html");
    const response = await fetch(url);
    const htmlContent = await response.text();

    const injectionTarget = await waitForElement(INJECTION_TARGET_ID);

    container.classList.add("yt-summarizer-container");
    container.innerHTML = htmlContent;
    injectionTarget.prepend(container);

    // Initial UI setup and event listeners
    initializeUI(container);
    setupEventListeners(
      container,
      currentVideoId,
      cachedMetadata,
      cachedTranscriptText,
      getTranscript,
      generateSummary,
      showTranscript
    );

    // Set up retry button explicitly here, as its ID is in ui.html
    const retryBtn = document.getElementById("retry-extract-btn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        initializeSummarizer(currentVideoId);
      });
    }
  } else {
    // If container exists (same page navigation), just reset view
    document.getElementById("initial-view").hidden = false;
    document.getElementById("summary-view").hidden = true;
    document.getElementById("loading").hidden = true;
    document.getElementById("error").hidden = true;
  }

  // --- Start Extraction ---
  try {
    // 1. Extract Metadata (required for summarizer call and downloads)
    cachedMetadata = await Metadata.extractMetadata();

    // 2. Attempt Transcript extraction (This is the primary function call)
    await getTranscript(currentVideoId);

    // 3. Immediately generate the default summary (concise)
    if (cachedTranscript) {
      await generateSummary("concise");
    }
  } catch (e) {
    console.error("Initialization failed:", e);
    showError("Could not initialize summarizer: " + e.message, true);
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

// Listener for URL changes (SPA navigation on YouTube) from background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "YOUTUBE_URL_CHANGED") {
    // Ensure we only initialize if the video ID is different (or it's a first load)
    const newVideoId = extractVideoId(request.url);
    if (newVideoId && newVideoId !== currentVideoId) {
      initializeSummarizer(newVideoId);
    }
    return true;
  }
});

// Initial load check
window.onload = () => {
  const url = window.location.href;
  const videoId = extractVideoId(url);
  if (videoId) {
    initializeSummarizer(videoId);
  }
};
