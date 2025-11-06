// content/ui/components.js

import { timestampToSeconds } from "../extraction/transcript.js";

export const initializeUI = (container) => {
  // FIX: This is a more comprehensive check for YouTube's dark mode
  const isDarkMode =
    document.documentElement.hasAttribute("dark") ||
    document.documentElement.getAttribute("dark") === "true" ||
    document.body.classList.contains("dark-mode");

  if (isDarkMode) {
    container.classList.add("dark-mode");
  }
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

  const formattedHtml = transcriptArray
    .map((entry) => {
      const [timestamp, text] = Object.entries(entry)[0];
      const seconds = timestampToSeconds(timestamp);
      return `<span class="timestamp" data-time="${seconds}" style="cursor: pointer; color: #065fd4; font-weight: 500;">${timestamp}</span> ${text}`;
    })
    .join("<br>");

  transcriptContent.innerHTML = formattedHtml;
  transcriptContent.hidden = false;
  transcriptContent.style.display = "block";

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
