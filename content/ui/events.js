// content/ui/events.js

export const setupEventListeners = (
  container,
  currentVideoId,
  cachedMetadata, // This is now passed correctly
  getTranscript,
  generateSummary,
  showTranscript
) => {
  // ===========================================
  // 1. HELPER FUNCTIONS (Defined first)
  // ===========================================
  const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  };

  const setActiveFilter = (activeId) => {
    container
      .querySelectorAll(".filter-btn")
      .forEach((btn) => btn.classList.remove("active"));
    const activeBtn = container.querySelector(`#${activeId}`);
    if (activeBtn) activeBtn.classList.add("active");
  };

  const createDownloadFilename = (metadata, fallbackId, type) => {
    // FIX: Use metadata.title (from the passed metadata object)
    const videoTitle = metadata?.title || fallbackId || `${type}_data`;
    const cleanTitle = videoTitle
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 150);
    return `${type}_${cleanTitle}.txt`;
  };

  const copyToClipboard = (text) => {
    if (!text) return Promise.resolve();
    return navigator.clipboard.writeText(text);
  };

  const downloadText = (filename = "transcript.txt", text) => {
    const blob = new Blob([text || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // ===========================================
  // 2. DOM ELEMENT QUERIES
  // ===========================================
  const tabSummary = container.querySelector("#tab-summary");
  const tabTranscript = container.querySelector("#tab-transcript");
  const pageSummary = container.querySelector("#summary-page");
  const pageTranscript = container.querySelector("#transcript-page");
  const copyBtn = container.querySelector("#copy-btn");
  const downloadBtn = container.querySelector("#download-btn");
  const summaryContent = container.querySelector("#summary-content");
  const transcriptContent = container.querySelector("#transcript-content");
  const summarizeBtn = container.querySelector("#summarize-btn");
  const filterGroup = container.querySelector("#summary-filter-group");
  const themeToggle = container.querySelector("#theme-toggle");

  // ===========================================
  // 3. ATTACH LISTENERS
  // ===========================================

  // --- Summary Tab ---
  tabSummary.addEventListener("click", () => {
    // ... (UI logic remains the same)
    tabSummary.classList.add("active");
    tabTranscript.classList.remove("active");
    pageSummary.classList.add("active");
    pageTranscript.classList.remove("active");
    pageSummary.hidden = false;
    pageTranscript.hidden = true;
    copyBtn.hidden = summaryContent.hidden;
    downloadBtn.hidden = summaryContent.hidden;
  });

  // --- Transcript Tab ---
  const handleTranscriptClick = async () => {
    tabTranscript.classList.add("active");
    tabSummary.classList.remove("active");
    pageTranscript.classList.add("active");
    pageSummary.classList.remove("active");
    pageTranscript.hidden = false;
    pageSummary.hidden = true;
    transcriptContent.hidden = false;
    transcriptContent.style.display = "block";
    transcriptContent.innerHTML = "Loading transcript...";

    // FIX: getTranscript now returns an object { array, text }
    const transcriptData = await getTranscript(currentVideoId);

    if (transcriptData && transcriptData.array) {
      showTranscript(transcriptData.array); // Render the HTML

      // FIX: Use the 'text' property from the returned data
      const textWithTimestamps =
        transcriptData.text || "Transcript text not found.";

      // Setup copy button
      copyBtn.onclick = () =>
        copyToClipboard(textWithTimestamps).then(() => {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = "✓ Copied!";
          setTimeout(() => (copyBtn.textContent = originalText), 2000);
        });

      // Setup download button
      const filename = createDownloadFilename(
        cachedMetadata, // This is the metadata object passed into setupEventListeners
        currentVideoId,
        "transcript"
      );
      downloadBtn.onclick = () => downloadText(filename, textWithTimestamps);

      copyBtn.hidden = false;
      downloadBtn.hidden = false;
    } else {
      transcriptContent.innerHTML = "Transcript not available.";
      copyBtn.hidden = true;
      downloadBtn.hidden = true;
    }
  };
  tabTranscript.addEventListener("click", debounce(handleTranscriptClick, 500));

  // --- Summarize Button ---
  if (summarizeBtn) {
    summarizeBtn.addEventListener("click", async () => {
      setActiveFilter("filter-insights");
      // generateSummary now pulls from the global cache
      await generateSummary("insights");
    });
  }

  // --- Filter Group ---
  if (filterGroup) {
    filterGroup.addEventListener(
      "click",
      debounce(async (e) => {
        if (e.target.classList.contains("filter-btn")) {
          const summaryType = e.target.id.replace("filter-", "");
          setActiveFilter(e.target.id);
          await generateSummary(summaryType); // Pass the type
        }
      }, 300)
    );
  }

  // --- Theme Toggle ---
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      // Toggle dark mode on the root container
      container.classList.toggle("dark-mode");
    });
  }

  // --- Global Copy (for Summary) ---
  copyBtn.addEventListener("click", () => {
    if (pageSummary.classList.contains("active")) {
      const summaryText = summaryContent.innerText;
      copyToClipboard(summaryText).then(() => {
        // ... (feedback logic)
      });
    }
  });

  // --- Global Download (for Summary) ---
  downloadBtn.addEventListener("click", () => {
    if (pageSummary.classList.contains("active")) {
      const summaryText = summaryContent.innerText;
      const filename = createDownloadFilename(
        cachedMetadata,
        currentVideoId,
        "summary"
      );
      downloadText(filename, summaryText);
    }
  });
};
