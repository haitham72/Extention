// content/extraction/transcript.js

export const timestampToSeconds = (timestamp) => {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
};

export const secondsToTimestamp = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const extractTranscriptClientSide = async (videoId) => {
  console.log("Starting fast client-side transcript extraction...");
  const video = document.querySelector("video");
  if (!video) throw new Error("Video element not found");

  const duration = video.duration || 600;
  const groupBy = duration >= 1200 ? 60 : duration >= 480 ? 30 : 15;
  console.log("Using time grouping:", groupBy, "seconds");

  let shouldClose = false;
  let segments = document.querySelectorAll("ytd-transcript-segment-renderer");

  if (segments.length === 0) {
    let opened = false;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const buttons = Array.from(document.querySelectorAll("button"));

    const transcriptButton = buttons.find(
      (btn) =>
        btn.getAttribute("aria-label") === "Transcript" ||
        btn.textContent?.trim().toLowerCase() === "transcript"
    );
    if (transcriptButton) {
      transcriptButton.click();
      shouldClose = true;
      for (let i = 0; i < 15; i++) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        segments = document.querySelectorAll("ytd-transcript-segment-renderer");
        if (segments.length > 0) {
          opened = true;
          break;
        }
      }
    }

    if (!opened) {
      const moreButton = buttons.find((btn) =>
        btn.getAttribute("aria-label")?.includes("More actions")
      );
      if (moreButton) {
        moreButton.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
        const menuButtons = Array.from(
          document.querySelectorAll("button, ytd-menu-service-item-renderer")
        );
        const transcriptOption = menuButtons.find((btn) =>
          btn.textContent?.toLowerCase().includes("show transcript")
        );
        if (transcriptOption) {
          transcriptOption.click();
          shouldClose = true;
          for (let i = 0; i < 15; i++) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            segments = document.querySelectorAll(
              "ytd-transcript-segment-renderer"
            );
            if (segments.length > 0) {
              opened = true;
              break;
            }
          }
        }
      }
    }

    if (!opened && segments.length === 0) {
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        segments = document.querySelectorAll("ytd-transcript-segment-renderer");
        if (segments.length > 0) break;
      }
    }

    if (segments.length === 0)
      throw new Error("No transcript available for this video.");
  }

  const transcriptContainer =
    document.querySelector("#segments-container") ||
    document.querySelector(
      "ytd-transcript-segment-list-renderer #segments-container"
    ) ||
    document.querySelector('[id="segments-container"]') ||
    document.querySelector(
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"] #content'
    );

  if (transcriptContainer) {
    let previousCount = segments.length;
    let stableCount = 0;
    for (let i = 0; i < 60; i++) {
      // Max attempts
      transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
      await new Promise((resolve) => setTimeout(resolve, 150));
      segments = document.querySelectorAll("ytd-transcript-segment-renderer");
      if (segments.length === previousCount) {
        stableCount++;
        if (stableCount >= 4) break;
      } else {
        stableCount = 0;
        previousCount = segments.length;
      }
    }
  }

  const groups = {};
  Array.from(segments).forEach((seg) => {
    const time =
      seg.querySelector(".segment-timestamp")?.textContent.trim() || "0:00";
    const text = seg.querySelector(".segment-text")?.textContent.trim() || "";
    if (!text) return;
    const seconds = timestampToSeconds(time);
    const group = Math.floor(seconds / groupBy) * groupBy;
    if (!groups[group]) groups[group] = [];
    groups[group].push(text);
  });

  if (Object.keys(groups).length === 0)
    throw new Error(
      `Found ${segments.length} segments but couldn't extract text.`
    );

  const transcriptArray = Object.keys(groups)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => {
      const time = secondsToTimestamp(Number(key));
      return { [time]: groups[key].join(" ") };
    });

  const transcriptText = Object.keys(groups)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => {
      const time = secondsToTimestamp(Number(key));
      return `[${time}] ${groups[key].join(" ")}`;
    })
    .join("\n");

  if (shouldClose) {
    const allButtons = Array.from(document.querySelectorAll("button"));
    const closeButton = allButtons.find((btn) => {
      const label = btn.getAttribute("aria-label")?.toLowerCase() || "";
      return label.includes("close") && label.includes("transcript");
    });
    if (closeButton) closeButton.click();
  }

  console.log(
    "Client-side extraction successful, segments:",
    transcriptArray.length
  );
  return { array: transcriptArray, text: transcriptText };
};

export const getTranscriptViaAPI = async (videoId) => {
  console.log("Fetching transcript via API...");
  const url = `${BACKEND_URL}/transcript?video_id=${videoId}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `API request failed with status ${response.status}`
    );
  }
  const data = await response.json();
  console.log("API transcript received");

  const lines = data.transcript.split("\n");
  const transcriptArray = lines
    .map((line) => {
      const match = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+(.+)$/);
      if (match) return { [match[1]]: match[2] };
      return null;
    })
    .filter(Boolean);

  const transcriptText = lines
    .filter((line) => line.trim())
    .map((line) => {
      const match = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+(.+)$/);
      return match ? `[${match[1]}] ${match[2]}` : line;
    })
    .join("\n");

  return { array: transcriptArray, text: transcriptText };
};
