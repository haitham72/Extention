// content/extraction/metadata.js

let cachedMetadata = null; // Local cache for this module

export const extractMetadata = async () => {
  if (cachedMetadata) {
    console.log("Using cached metadata");
    return cachedMetadata;
  }
  console.log("Extracting essential metadata...");
  const video = document.querySelector("video");
  const duration = video?.duration || 600;

  // Get like count
  let likeCount = null;
  const likeButton =
    document.querySelector(
      'like-button-view-model button[aria-label*="like"]'
    ) ||
    document.querySelector(
      'ytd-toggle-button-renderer.ytd-menu-renderer button[aria-label*="like"]'
    );
  if (likeButton) {
    const ariaLabel = likeButton.getAttribute("aria-label");
    const match = ariaLabel?.match(/[\d,]+/);
    likeCount = match ? match[0].replace(/,/g, "") : null;
  }

  // Get subscriber count
  let subscriberCount = null;
  const subButton =
    document.querySelector("#subscriber-count")?.textContent?.trim() ||
    document
      .querySelector("ytd-subscribe-button-renderer #owner-sub-count")
      ?.textContent?.trim();
  if (subButton) subscriberCount = subButton;

  // Get social links
  const socialLinks = {};
  document
    .querySelectorAll("ytd-channel-tagline-renderer a, #link-list-container a")
    .forEach((link) => {
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
    title:
      document
        .querySelector("h1.ytd-watch-metadata yt-formatted-string")
        ?.textContent?.trim() ||
      document.querySelector("h1.title")?.textContent?.trim() ||
      "Unknown Title",
    video_id: new URLSearchParams(window.location.search).get("v") || "",
    channel: {
      name:
        document
          .querySelector("ytd-channel-name#channel-name yt-formatted-string a")
          ?.textContent?.trim() ||
        document.querySelector("#channel-name a")?.textContent?.trim() ||
        "Unknown Channel",
      url:
        document.querySelector(
          "ytd-channel-name#channel-name yt-formatted-string a"
        )?.href ||
        document.querySelector("#channel-name a")?.href ||
        "",
      subscriber_count: subscriberCount,
    },
    content: {
      duration_seconds: Math.floor(duration),
      duration_formatted: (() => {
        const hours = Math.floor(duration / 3600);
        const mins = Math.floor((duration % 3600) / 60);
        const secs = Math.floor(duration % 60);
        if (hours > 0)
          return `${hours}:${mins.toString().padStart(2, "0")}:${secs
            .toString()
            .padStart(2, "0")}`;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
      })(),
    },
    engagement: {
      view_count:
        document
          .querySelector("ytd-video-view-count-renderer .view-count")
          ?.textContent?.trim() ||
        document.querySelector("#info span.view-count")?.textContent?.trim() ||
        "Unknown",
      upload_date:
        document
          .querySelector("#info-strings yt-formatted-string")
          ?.textContent?.trim() ||
        document
          .querySelector("#date yt-formatted-string")
          ?.textContent?.trim() ||
        "Unknown",
      like_count: likeCount,
    },
    context: {
      social_links: Object.keys(socialLinks).length > 0 ? socialLinks : null,
    },
    extraction_timestamp: new Date().toISOString(),
  };

  cachedMetadata = metadata;
  console.log("Essential metadata extraction complete");
  return metadata;
};
