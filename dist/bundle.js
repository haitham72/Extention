(() => {
  // sl-summarizer/youtube-side-extention-v4/content/extraction/transcript.js
  var timestampToSeconds = (timestamp) => {
    const parts = timestamp.split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  };
  var secondsToTimestamp = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  var extractTranscriptClientSide = async (videoId) => {
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
      await new Promise((resolve) => setTimeout(resolve, 1e3));
      const buttons = Array.from(document.querySelectorAll("button"));
      const transcriptButton = buttons.find(
        (btn) => btn.getAttribute("aria-label") === "Transcript" || btn.textContent?.trim().toLowerCase() === "transcript"
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
        const moreButton = buttons.find(
          (btn) => btn.getAttribute("aria-label")?.includes("More actions")
        );
        if (moreButton) {
          moreButton.click();
          await new Promise((resolve) => setTimeout(resolve, 500));
          const menuButtons = Array.from(
            document.querySelectorAll("button, ytd-menu-service-item-renderer")
          );
          const transcriptOption = menuButtons.find(
            (btn) => btn.textContent?.toLowerCase().includes("show transcript")
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
    const transcriptContainer = document.querySelector("#segments-container") || document.querySelector(
      "ytd-transcript-segment-list-renderer #segments-container"
    ) || document.querySelector('[id="segments-container"]') || document.querySelector(
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"] #content'
    );
    if (transcriptContainer) {
      let previousCount = segments.length;
      let stableCount = 0;
      for (let i = 0; i < 60; i++) {
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
      const time = seg.querySelector(".segment-timestamp")?.textContent.trim() || "0:00";
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
    const transcriptArray = Object.keys(groups).sort((a, b) => Number(a) - Number(b)).map((key) => {
      const time = secondsToTimestamp(Number(key));
      return { [time]: groups[key].join(" ") };
    });
    const transcriptText = Object.keys(groups).sort((a, b) => Number(a) - Number(b)).map((key) => {
      const time = secondsToTimestamp(Number(key));
      return `[${time}] ${groups[key].join(" ")}`;
    }).join("\n");
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

  // sl-summarizer/youtube-side-extention-v4/content/extraction/metadata.js
  var cachedMetadata = null;
  var extractMetadata = async () => {
    if (cachedMetadata) {
      console.log("Using cached metadata");
      return cachedMetadata;
    }
    console.log("Extracting essential metadata...");
    const video = document.querySelector("video");
    const duration = video?.duration || 600;
    let likeCount = null;
    const likeButton = document.querySelector(
      'like-button-view-model button[aria-label*="like"]'
    ) || document.querySelector(
      'ytd-toggle-button-renderer.ytd-menu-renderer button[aria-label*="like"]'
    );
    if (likeButton) {
      const ariaLabel = likeButton.getAttribute("aria-label");
      const match = ariaLabel?.match(/[\d,]+/);
      likeCount = match ? match[0].replace(/,/g, "") : null;
    }
    let subscriberCount = null;
    const subButton = document.querySelector("#subscriber-count")?.textContent?.trim() || document.querySelector("ytd-subscribe-button-renderer #owner-sub-count")?.textContent?.trim();
    if (subButton) subscriberCount = subButton;
    const socialLinks = {};
    document.querySelectorAll("ytd-channel-tagline-renderer a, #link-list-container a").forEach((link) => {
      const href = link.href;
      const text = link.textContent?.toLowerCase() || "";
      if (href.includes("instagram.com")) socialLinks.instagram = href;
      else if (href.includes("tiktok.com")) socialLinks.tiktok = href;
      else if (href.includes("twitter.com") || href.includes("x.com"))
        socialLinks.twitter = href;
      else if (href.includes("facebook.com")) socialLinks.facebook = href;
      else if (text.includes("website") || text.includes("site"))
        socialLinks.website = href;
    });
    const metadata = {
      title: document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent?.trim() || document.querySelector("h1.title")?.textContent?.trim() || "Unknown Title",
      video_id: new URLSearchParams(window.location.search).get("v") || "",
      channel: {
        name: document.querySelector("ytd-channel-name#channel-name yt-formatted-string a")?.textContent?.trim() || document.querySelector("#channel-name a")?.textContent?.trim() || "Unknown Channel",
        url: document.querySelector(
          "ytd-channel-name#channel-name yt-formatted-string a"
        )?.href || document.querySelector("#channel-name a")?.href || "",
        subscriber_count: subscriberCount
      },
      content: {
        duration_seconds: Math.floor(duration),
        duration_formatted: (() => {
          const hours = Math.floor(duration / 3600);
          const mins = Math.floor(duration % 3600 / 60);
          const secs = Math.floor(duration % 60);
          if (hours > 0)
            return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
          return `${mins}:${secs.toString().padStart(2, "0")}`;
        })()
      },
      engagement: {
        view_count: document.querySelector("ytd-video-view-count-renderer .view-count")?.textContent?.trim() || document.querySelector("#info span.view-count")?.textContent?.trim() || "Unknown",
        upload_date: document.querySelector("#info-strings yt-formatted-string")?.textContent?.trim() || document.querySelector("#date yt-formatted-string")?.textContent?.trim() || "Unknown",
        like_count: likeCount
      },
      context: {
        social_links: Object.keys(socialLinks).length > 0 ? socialLinks : null
      },
      extraction_timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    cachedMetadata = metadata;
    console.log("Essential metadata extraction complete");
    return metadata;
  };

  // sl-summarizer/youtube-side-extention-v4/content/extraction/chapters.js
  var extractChapters = async () => {
    console.log("Extracting chapters...");
    const chaptersMap = /* @__PURE__ */ new Map();
    document.querySelectorAll("ytd-macro-markers-list-item-renderer").forEach((item) => {
      const timeEl = item.querySelector("#time");
      const titleEl = item.querySelector("#details h4");
      if (timeEl && titleEl)
        chaptersMap.set(timeEl.textContent.trim(), titleEl.textContent.trim());
    });
    if (chaptersMap.size === 0) {
      document.querySelectorAll(
        "#structured-description ytd-horizontal-card-list-renderer ytd-macro-markers-list-item-renderer"
      ).forEach((item) => {
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
    const sortedChapters = Array.from(chaptersMap.entries()).sort((a, b) => timestampToSeconds2(a[0]) - timestampToSeconds2(b[0])).map(([timestamp, title]) => ({ timestamp, title }));
    console.log(`Found ${sortedChapters.length} chapters`);
    return sortedChapters;
  };
  var timestampToSeconds2 = (timestamp) => {
    const parts = timestamp.split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  };

  // sl-summarizer/youtube-side-extention-v4/content/extraction/description.js
  var extractDescription = async () => {
    console.log("Extracting video description...");
    const descriptionContainer = document.querySelector("#description");
    const descriptionText = descriptionContainer?.textContent?.trim() || "No description available.";
    return descriptionText;
  };

  // sl-summarizer/youtube-side-extention-v4/content/backend/api.js
  var BACKEND_URL2 = "http://127.0.0.1:5000";
  var sendToBackend = async (videoId, transcriptData, metadata) => {
    try {
      console.log("Preparing data for backend...");
      const chapters = await extractChapters();
      const description = await extractDescription();
      const fullData = {
        video_id: videoId,
        // FIX: Use the 'metadata' object that was passed in
        video_title: metadata?.title || videoId,
        metadata,
        // Send the full metadata object
        description,
        chapters,
        transcript_structured: transcriptData.array,
        extraction_timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      console.log("Sending data to backend...");
      const response = await fetch(`${BACKEND_URL2}/store-video-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullData),
        signal: AbortSignal.timeout(15e3)
      });
      if (response.ok) {
        console.log("\u2705 Data sent to backend successfully");
      } else {
        console.warn("\u26A0\uFE0F Backend storage failed:", response.status);
      }
    } catch (e) {
      console.warn("Could not send to backend:", e.message || e);
    }
  };
  var getTranscriptFromAPI = async (videoId) => {
    const url = `${BACKEND_URL2}/transcript?video_id=${videoId}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `API request failed with status ${response.status}`
      );
    }
    const data = await response.json();
    return data.transcript;
  };
  var getSummaryFromAPI = async (transcript, summaryType) => {
    const url = `${BACKEND_URL2}/summarize`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, summary_type: summaryType }),
      signal: AbortSignal.timeout(6e4)
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

  // sl-summarizer/youtube-side-extention-v4/content/ui/components.js
  var initializeUI = (container) => {
    const isDarkMode = document.documentElement.hasAttribute("dark") || document.documentElement.getAttribute("dark") === "true" || document.body.classList.contains("dark-mode");
    if (isDarkMode) {
      container.classList.add("dark-mode");
    }
  };
  var showSummary = (summaryText) => {
    const formattedHtml = summaryText.replace(/\n/g, "<br>").replace(/•/g, "<br>\u2022").replace(/Key Insights:/i, "<strong>Key Insights:</strong>");
    const summaryContent = document.getElementById("summary-content");
    summaryContent.innerHTML = formattedHtml;
    summaryContent.hidden = false;
    document.getElementById("initial-view").hidden = true;
    document.getElementById("summary-view").hidden = false;
    document.getElementById("copy-btn").hidden = false;
    document.getElementById("error").hidden = true;
  };
  var showTranscript = (transcriptArray) => {
    const transcriptContent = document.getElementById("transcript-content");
    const formattedHtml = transcriptArray.map((entry) => {
      const [timestamp, text] = Object.entries(entry)[0];
      const seconds = timestampToSeconds(timestamp);
      return `<span class="timestamp" data-time="${seconds}" style="cursor: pointer; color: #065fd4; font-weight: 500;">${timestamp}</span> ${text}`;
    }).join("<br>");
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

  // sl-summarizer/youtube-side-extention-v4/content/ui/events.js
  var setupEventListeners = (container, currentVideoId2, cachedMetadata3, getTranscript2, generateSummary2, showTranscript2) => {
    const debounce = (func, delay) => {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(void 0, args), delay);
      };
    };
    const setActiveFilter = (activeId) => {
      container.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
      const activeBtn = container.querySelector(`#${activeId}`);
      if (activeBtn) activeBtn.classList.add("active");
    };
    const createDownloadFilename = (metadata, fallbackId, type) => {
      const videoTitle = metadata?.title || fallbackId || `${type}_data`;
      const cleanTitle = videoTitle.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").substring(0, 50);
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
      setTimeout(() => URL.revokeObjectURL(url), 5e3);
    };
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
    tabSummary.addEventListener("click", () => {
      tabSummary.classList.add("active");
      tabTranscript.classList.remove("active");
      pageSummary.classList.add("active");
      pageTranscript.classList.remove("active");
      pageSummary.hidden = false;
      pageTranscript.hidden = true;
      copyBtn.hidden = summaryContent.hidden;
      downloadBtn.hidden = summaryContent.hidden;
    });
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
      const transcriptData = await getTranscript2(currentVideoId2);
      if (transcriptData && transcriptData.array) {
        showTranscript2(transcriptData.array);
        const textWithTimestamps = transcriptData.text || "Transcript text not found.";
        copyBtn.onclick = () => copyToClipboard(textWithTimestamps).then(() => {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = "\u2713 Copied!";
          setTimeout(() => copyBtn.textContent = originalText, 2e3);
        });
        const filename = createDownloadFilename(
          cachedMetadata3,
          // This is the metadata object passed into setupEventListeners
          currentVideoId2,
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
    if (summarizeBtn) {
      summarizeBtn.addEventListener("click", async () => {
        setActiveFilter("filter-insights");
        await generateSummary2("insights");
      });
    }
    if (filterGroup) {
      filterGroup.addEventListener(
        "click",
        debounce(async (e) => {
          if (e.target.classList.contains("filter-btn")) {
            const summaryType = e.target.id.replace("filter-", "");
            setActiveFilter(e.target.id);
            await generateSummary2(summaryType);
          }
        }, 300)
      );
    }
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        container.classList.toggle("dark-mode");
      });
    }
    copyBtn.addEventListener("click", () => {
      if (pageSummary.classList.contains("active")) {
        const summaryText = summaryContent.innerText;
        copyToClipboard(summaryText).then(() => {
        });
      }
    });
    downloadBtn.addEventListener("click", () => {
      if (pageSummary.classList.contains("active")) {
        const summaryText = summaryContent.innerText;
        const filename = createDownloadFilename(
          cachedMetadata3,
          currentVideoId2,
          "summary"
        );
        downloadText(filename, summaryText);
      }
    });
  };

  // sl-summarizer/youtube-side-extention-v4/content/moduleEntryPoint.js
  var ROOT_ID = "yt-summarizer-root";
  var INJECTION_TARGET_ID = "#secondary";
  var currentVideoId = null;
  var cachedTranscriptArray = null;
  var cachedTranscriptText = null;
  var cachedMetadata2 = null;
  var cachedSummaries = {};
  var isSummarizing = false;
  var isExtracting = false;
  function extractTranscriptArrayFromText(transcriptText) {
    if (!transcriptText) return [];
    const lines = transcriptText.split("\n");
    return lines.map((line) => {
      const match = line.match(
        /^\\[?(\\d{1,2}:\\d{2}(?::\\d{2})?)\\]?\\s+(.+)$/
      );
      if (match) {
        return { [match[1]]: match[2] };
      }
      return null;
    }).filter(Boolean);
  }
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
      try {
        transcriptData = await extractTranscriptClientSide(videoId);
      } catch (clientError) {
        console.warn(
          "Client-side extraction failed, falling back to API:",
          clientError.message
        );
      }
      if (!transcriptData || !transcriptData.array || transcriptData.array.length === 0) {
        const apiTranscriptText = await getTranscriptFromAPI(videoId);
        transcriptData = {
          array: extractTranscriptArrayFromText(apiTranscriptText),
          text: apiTranscriptText
        };
      }
      cachedTranscriptArray = transcriptData.array;
      cachedTranscriptText = transcriptData.text;
      sendToBackend(videoId, transcriptData, cachedMetadata2).catch(
        (e) => console.warn("Background sendToBackend failed:", e)
      );
      return transcriptData;
    } catch (e) {
      console.error("getTranscript error:", e);
      document.getElementById("error").textContent = e.message || "Failed to get transcript.";
      document.getElementById("error").hidden = false;
      return { array: null, text: null };
    } finally {
      isExtracting = false;
      document.getElementById("loading").hidden = true;
    }
  }
  async function generateSummary(summaryType) {
    if (isSummarizing) return;
    if (!cachedTranscriptText) {
      console.log("Waiting for transcript to summarize...");
      const transcriptData = await getTranscript(currentVideoId);
      if (!transcriptData || !transcriptData.text) {
        console.error("Cannot summarize, transcript text is unavailable.");
        return;
      }
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
  async function initializeSummarizer(videoId) {
    console.log("Initializing summarizer for video:", videoId);
    currentVideoId = videoId;
    cachedTranscriptArray = null;
    cachedTranscriptText = null;
    cachedMetadata2 = null;
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
      const uiHtml = await fetch(chrome.runtime.getURL("ui.html")).then(
        (r) => r.text()
      );
      container.innerHTML = uiHtml;
      cachedMetadata2 = await extractMetadata();
      initializeUI(container);
      setupEventListeners(
        container,
        currentVideoId,
        cachedMetadata2,
        // Pass the loaded metadata
        getTranscript,
        generateSummary,
        showTranscript
      );
    } catch (e) {
      console.error("Failed to load ui.html:", e);
      container.innerHTML = '<p style="color: red;">Error: Could not load UI.</p>';
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
  var initialVideoId = extractVideoId(window.location.href);
  if (initialVideoId) {
    initializeSummarizer(initialVideoId);
  }
})();
//# sourceMappingURL=bundle.js.map
