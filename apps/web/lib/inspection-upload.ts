const MAX_INPUT = 3 * 1024 * 1024;
const MAX_BATCH = 3_000_000;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function compact(file: File, budget: number): Promise<File> {
  if (file.size <= budget) return file;
  const url = URL.createObjectURL(file);
  try {
    const photo = new Image();
    photo.src = url;
    await photo.decode();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("image_invalid");
    for (const max of [1400, 1050, 800, 600]) {
      const ratio = Math.min(
        1,
        max / Math.max(photo.naturalWidth, photo.naturalHeight),
      );
      canvas.width = Math.max(1, Math.round(photo.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(photo.naturalHeight * ratio));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(photo, 0, 0, canvas.width, canvas.height);
      const encoded = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.83),
      );
      if (encoded && encoded.size <= budget)
        return new File([encoded], file.name.replace(/\.[^.]*$/, "") + ".jpg", {
          type: "image/jpeg",
        });
    }
    throw new Error("image_too_large");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function fitInspectionPhotos(data: FormData): Promise<void> {
  const files = data
    .getAll("images")
    .filter((file): file is File => file instanceof File && file.size > 0);
  if (files.length < 1 || files.length > 4) throw new Error("photos_required");
  if (files.some((file) => !TYPES.has(file.type)))
    throw new Error("image_invalid");
  if (files.some((file) => file.size > MAX_INPUT))
    throw new Error("image_too_large");
  if (files.reduce((total, file) => total + file.size, 0) <= MAX_BATCH) return;
  data.delete("images");
  for (const file of files) {
    data.append(
      "images",
      await compact(file, Math.floor(MAX_BATCH / files.length)),
    );
  }
}
