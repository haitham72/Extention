// content/extraction/transcript.js (Final Robust Scraper - REMOVED API FUNCTION)

export const timestampToSeconds = (timestamp) => {
  const parts = timestamp.split(":").map(Number).reverse();
  let seconds = 0;
  seconds += parts[0] || 0;
  seconds += (parts[1] || 0) * 60;
  seconds += (parts[2] || 0) * 3600;
  return seconds;
};

export const secondsToTimestamp = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

/**
 * FINAL ROBUST CLIENT-SIDE SCRAPER
 */
export const extractTranscriptClientSide = async (videoId) => {
  console.log("Starting final robust client-side transcript extraction...");
  const video = document.querySelector("video");
  if (!video) throw new Error("Video element not found");

  const duration = video.duration || 600;
  const groupBy = duration >= 1200 ? 60 : duration >= 480 ? 30 : 15;
  console.log("Using time grouping:", groupBy, "seconds");

  let shouldClose = false;
  let segments = document.querySelectorAll("ytd-transcript-segment-renderer");

  if (segments.length === 0) {
    console.log("Transcript panel not open. Trying to open it...");

    try {
      // 1. Click the "More" button to expand the description box
      const moreDescriptionButton =
        document.querySelector("#description #expand") ||
        document.querySelector("#expand-button") ||
        Array.from(
          document.querySelectorAll("yt-formatted-string.more-button")
        ).find((btn) => btn.textContent?.trim().toLowerCase() === "more");

      if (moreDescriptionButton) {
        console.log("Clicking description 'More' button...");
        moreDescriptionButton.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // 2. Aggressively find and click the "Show transcript" button
      const allButtons = Array.from(
        document.querySelectorAll(
          "ytd-button-renderer a, yt-button-shape button, button[aria-label], ytd-menu-service-item-renderer yt-formatted-string"
        )
      );

      const transcriptButton = allButtons.find((btn) => {
        const text = btn.textContent?.trim().toLowerCase();
        const label = btn.getAttribute("aria-label")?.toLowerCase();

        return (
          text === "show transcript" ||
          text === "show full transcript" ||
          (label &&
            (label.includes("show") || label.includes("open")) &&
            label.includes("transcript"))
        );
      });

      if (transcriptButton) {
        console.log("Found 'Show transcript' button. Clicking...");
        transcriptButton.click();
        shouldClose = true;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.warn(
          "Could not find 'Show transcript' button via aggressive search."
        );
      }

      segments = document.querySelectorAll("ytd-transcript-segment-renderer");
    } catch (e) {
      console.error("Error trying to open transcript panel:", e);
    }

    if (segments.length === 0) {
      throw new Error(
        "Transcript not available on YouTube page (scraper failed)."
      );
    }
  }

  // --- Parsing Logic ---
  const rawTranscriptArray = Array.from(segments)
    .map((seg) => {
      const textElement = seg.querySelector(".segment-text");
      const timeElement = seg.querySelector(".segment-timestamp");
      if (textElement && timeElement) {
        return {
          timestamp: timeElement.textContent.trim(),
          text: textElement.textContent.trim().replace(/\n/g, " "),
        };
      }
      return null;
    })
    .filter(Boolean);

  const groupedTranscriptMap = new Map();
  let transcriptText = "";

  rawTranscriptArray.forEach((item) => {
    const seconds = timestampToSeconds(item.timestamp);
    let groupKeySeconds = Math.floor(seconds / groupBy) * groupBy;
    const groupKey = secondsToTimestamp(groupKeySeconds);

    if (!groupedTranscriptMap.has(groupKey)) {
      groupedTranscriptMap.set(groupKey, []);
    }
    groupedTranscriptMap.get(groupKey).push(item.text);
  });

  const transcriptArray = [];
  groupedTranscriptMap.forEach((texts, timestamp) => {
    const fullText = texts.join(" ");
    transcriptArray.push({ [timestamp]: fullText });
    transcriptText += `[${timestamp}] ${fullText}\n`;
  });

  // Closing logic
  if (shouldClose) {
    const closeButton = document.querySelector(
      "ytd-engagement-panel-section-list-renderer #dismiss-button, ytd-transcript-renderer #dismiss-button"
    );
    if (closeButton) closeButton.click();
  }

  console.log(
    "Client-side extraction successful, segments:",
    transcriptArray.length
  );
  return { array: transcriptArray, text: transcriptText };
};
