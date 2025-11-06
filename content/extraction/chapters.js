// content/extraction/chapters.js

export const extractChapters = async () => {
  console.log("Extracting chapters...");
  const chaptersMap = new Map();
  document
    .querySelectorAll("ytd-macro-markers-list-item-renderer")
    .forEach((item) => {
      const timeEl = item.querySelector("#time");
      const titleEl = item.querySelector("#details h4");
      if (timeEl && titleEl)
        chaptersMap.set(timeEl.textContent.trim(), titleEl.textContent.trim());
    });

  if (chaptersMap.size === 0) {
    document
      .querySelectorAll(
        "#structured-description ytd-horizontal-card-list-renderer ytd-macro-markers-list-item-renderer"
      )
      .forEach((item) => {
        const timeEl = item.querySelector("#time");
        const titleEl = item.querySelector("#details h4");
        if (timeEl && titleEl)
          chaptersMap.set(
            timeEl.textContent.trim(),
            titleEl.textContent.trim()
          );
      });
  }

  if (chaptersMap.size === 0) {
    console.log("No chapters found");
    return [];
  }

  const sortedChapters = Array.from(chaptersMap.entries())
    .sort((a, b) => timestampToSeconds(a[0]) - timestampToSeconds(b[0]))
    .map(([timestamp, title]) => ({ timestamp, title }));

  console.log(`Found ${sortedChapters.length} chapters`);
  return sortedChapters;
};

// Import timestampToSeconds from transcript module if needed
// import { timestampToSeconds } from './transcript.js'; // Uncomment if not available globally
const timestampToSeconds = (timestamp) => {
  // Fallback if not imported
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
};
