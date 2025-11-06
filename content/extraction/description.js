// content/extraction/description.js

export const extractDescription = async () => {
  console.log("Extracting video description...");
  // Find the description element on YouTube
  const descriptionContainer = document.querySelector("#description");
  const descriptionText =
    descriptionContainer?.textContent?.trim() || "No description available.";

  // This function simply returns the plain text description.
  return descriptionText;
};
