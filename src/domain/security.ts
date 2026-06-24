export const maxUploadSizeInBytes = 25 * 1024 * 1024;
export const maxFilesPerUpload = 10;

export const allowedMimeTypes = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt"
} as const;

export type AllowedMimeType = keyof typeof allowedMimeTypes;
