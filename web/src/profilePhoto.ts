import contract from "../shared/profile-contract.json";

export async function prepareProfilePhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size > contract.photo.maxSourceBytes) throw new Error("Choose an image smaller than 10 MB.");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error("This image couldn’t be opened. Try another photo."); }
  try {
    if (!bitmap.width || !bitmap.height) throw new Error("This image is empty. Try another photo.");
    const canvas = document.createElement("canvas");
    canvas.width = contract.photo.size; canvas.height = contract.photo.size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo editing isn’t available in this browser.");
    context.fillStyle = "#222428"; context.fillRect(0, 0, canvas.width, canvas.height);
    const edge = Math.min(bitmap.width, bitmap.height);
    context.drawImage(bitmap, (bitmap.width - edge) / 2, (bitmap.height - edge) / 2, edge, edge, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.8, 0.65]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, contract.photo.mimeType, quality));
      if (blob && blob.size <= contract.photo.maxBytes) {
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("This photo couldn’t be read. Try again."));
          reader.readAsDataURL(blob);
        });
      }
    }
    throw new Error("This photo is too large after resizing. Try a smaller image.");
  } finally { bitmap.close(); }
}
