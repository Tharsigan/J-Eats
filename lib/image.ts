export const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp";
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/** Validate a food photo; returns an error message or "" when it is fine. */
export function checkImageFile(file: File) {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!ALLOWED.includes(file.type) && ![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    return "Please choose a JPG or PNG image.";
  }
  if (file.size > IMAGE_MAX_BYTES) return "That image is larger than 5MB. Choose a smaller photo.";
  return "";
}

/**
 * Shrink a photo in the browser (max 800px wide) and return it as a JPEG data URL,
 * small enough to keep in the demo's localStorage.
 */
export function imageFileToDataUrl(file: File, maxWidth = 800, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Your browser could not process this image."));
        return;
      }
      ctx.fillStyle = "#ffffff"; // transparent PNG areas become white, not black
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file could not be read as an image."));
    };
    img.src = url;
  });
}
