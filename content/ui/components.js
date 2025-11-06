export const initializeUI = (container) => {
  // Set initial theme based on YouTube's theme or system preference
  const isDarkMode =
    document.documentElement.hasAttribute("dark") ||
    document.body.classList.contains("dark") ||
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (isDarkMode) container.classList.add("dark-mode");
};

export const showSummary = (summaryText) => {
  const formattedHtml = summaryText
    .replace(/\n/g, "<br>")
    .replace(/•/g, "<br>•")
    .replace(/Key Insights:/i, "<strong>Key Insights:</strong>");
  const summaryContent = document.getElementById("summary-content");
  summaryContent.innerHTML = formattedHtml;
  summaryContent.hidden = false;
  document.getElementById("initial-view").hidden = true;
  document.getElementById("summary-view").hidden = false;
  document.getElementById("copy-btn").hidden = false;
  document.getElementById("error").hidden = true;
};

export const showTranscript = (transcriptArray) => {
  const transcriptContent = document.getElementById("transcript-content");

  // --- UI Adjustment: Add Header ---
  const transcriptHeader = "<strong>✏️ Transcript</strong><br>";

  // Format with clickable timestamps - THIS IS THE KEY PART FOR TIMESTAMP SYNC
  const formattedTranscriptLines = transcriptArray
    .map((entry) => {
      const [timestamp, text] = Object.entries(entry)[0];
      const seconds = timestampToSeconds(timestamp);

      // UI Adjustment: Use helper function to ensure MM:SS format for display
      const displayTimestamp = secondsToFormattedTimestamp(seconds);

      return `<span class="timestamp" data-time="${seconds}" style="cursor: pointer; color: #065fd4; font-weight: 500;">${displayTimestamp}</span> ${text}`;
    })
    .join("<br>");

  const formattedHtml = transcriptHeader + formattedTranscriptLines;
  // ---------------------------------

  transcriptContent.innerHTML = formattedHtml;
  transcriptContent.hidden = false;
  transcriptContent.style.display = "block";

  // Add click listeners to timestamps - THIS ENABLES THE SYNC
  transcriptContent.querySelectorAll(".timestamp").forEach((span) => {
    span.addEventListener("click", () => {
      const time = parseFloat(span.getAttribute("data-time"));
      const video = document.querySelector("video");
      if (video) {
        video.currentTime = time;
        video.play();
      }
    });
  });

  const transcriptInitialView = document.getElementById(
    "transcript-initial-view"
  );
  transcriptInitialView.hidden = true;
  transcriptInitialView.style.display = "none";

  document.getElementById("copy-btn").hidden = false;
  document.getElementById("error").hidden = true;
};

// Helper function for timestamp conversion if not available globally
const timestampToSeconds = (timestamp) => {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
};

// NEW HELPER FUNCTION to format total seconds into a zero-padded MM:SS or H:MM:SS string
const secondsToFormattedTimestamp = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (num) => String(num).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
};
