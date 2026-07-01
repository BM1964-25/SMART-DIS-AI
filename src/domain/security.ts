export const maxUploadSizeInBytes = 25 * 1024 * 1024;
export const maxFilesPerUpload = 10;
export const maxLocalFolderFiles = 200;

export const allowedMimeTypes = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "text/csv": "csv"
} as const;

export type AllowedMimeType = keyof typeof allowedMimeTypes;

export const allowedFileExtensionLabels = ["PDF", "DOCX", "TXT", "XLSX", "XLS", "CSV"] as const;

export const allowedFileExtensions = ["pdf", "docx", "txt", "xlsx", "xls", "csv"] as const;

export const allowedFileExtensionText = allowedFileExtensionLabels.join(", ");

export const allowedAcceptValue = [
  ...Object.keys(allowedMimeTypes),
  ".pdf",
  ".docx",
  ".txt",
  ".xlsx",
  ".xls",
  ".csv"
].join(",");
