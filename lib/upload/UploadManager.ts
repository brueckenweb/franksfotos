/**
 * FranksFotos – Upload-Manager
 * Adaptiert von brueckenweb /lib/upload/UploadManager.ts
 * Ziel: https://pics.frank-sellke.de
 */

import { UPLOAD_CONFIG, UploadConfigHelper } from "./config";

export interface UploadResult {
  success: boolean;
  fileName?: string;
  originalName: string;
  fileSize: number;
  fileUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  uploadTime?: number;
}

export interface BatchUploadResult {
  success: boolean;
  totalFiles: number;
  successfulUploads: UploadResult[];
  failedUploads: UploadResult[];
  message: string;
  uploadTime: number;
}

export interface UploadProgress {
  fileName: string;
  loaded: number;
  total: number;
  percentage: number;
  status: "pending" | "uploading" | "completed" | "failed";
  error?: string;
}

export type ProgressCallback = (progress: UploadProgress) => void;

/**
 * Hauptklasse für Upload-Management zu pics.frank-sellke.de
 */
export class UploadManager {
  private targetKey: string;
  private apiKey: string;

  constructor(targetKey: string) {
    this.targetKey = targetKey;
    this.apiKey = process.env.UPLOAD_API_KEY || "";

    const config = UPLOAD_CONFIG.targets[targetKey];
    if (!config) {
      throw new Error(`Unbekanntes Upload-Ziel: ${targetKey}`);
    }
  }

  /**
   * Einzelne Datei hochladen
   */
  async uploadFile(
    file: File,
    options: {
      onProgress?: ProgressCallback;
      generateUniqueName?: boolean;
      subfolder?: string;
    } = {}
  ): Promise<UploadResult> {
    const startTime = Date.now();

    // Datei validieren
    const validation = UploadConfigHelper.validateFile(
      { name: file.name, size: file.size, type: file.type },
      this.targetKey
    );

    if (!validation.valid) {
      return {
        success: false,
        originalName: file.name,
        fileSize: file.size,
        error: validation.error,
      };
    }

    // Dateiname generieren
    const fileName = options.generateUniqueName
      ? UploadConfigHelper.generateUniqueFilename(file.name)
      : UploadConfigHelper.sanitizeFilename(file.name);

    if (options.onProgress) {
      options.onProgress({
        fileName,
        loaded: 0,
        total: file.size,
        percentage: 0,
        status: "pending",
      });
    }

    try {
      const result = await this.uploadToRemote(file, fileName, options);
      result.uploadTime = Date.now() - startTime;
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unbekannter Fehler";

      if (options.onProgress) {
        options.onProgress({
          fileName,
          loaded: 0,
          total: file.size,
          percentage: 0,
          status: "failed",
          error: errorMessage,
        });
      }

      return {
        success: false,
        originalName: file.name,
        fileSize: file.size,
        error: errorMessage,
        uploadTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Mehrere Dateien gleichzeitig hochladen
   */
  async uploadMultiple(
    files: File[],
    options: {
      onProgress?: (fileName: string, progress: UploadProgress) => void;
      onComplete?: (fileName: string, result: UploadResult) => void;
      generateUniqueNames?: boolean;
      maxConcurrent?: number;
      subfolder?: string;
    } = {}
  ): Promise<BatchUploadResult> {
    const startTime = Date.now();
    const maxConcurrent =
      options.maxConcurrent || UPLOAD_CONFIG.general.maxConcurrentUploads;

    const successfulUploads: UploadResult[] = [];
    const failedUploads: UploadResult[] = [];

    // Dateien in Batches aufteilen
    const batches: File[][] = [];
    for (let i = 0; i < files.length; i += maxConcurrent) {
      batches.push(files.slice(i, i + maxConcurrent));
    }

    for (const batch of batches) {
      const batchPromises = batch.map((file) =>
        this.uploadFile(file, {
          onProgress: options.onProgress
            ? (progress) => options.onProgress!(file.name, progress)
            : undefined,
          generateUniqueName: options.generateUniqueNames,
          subfolder: options.subfolder,
        })
      );

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if (result.success) {
          successfulUploads.push(result);
        } else {
          failedUploads.push(result);
        }

        if (options.onComplete) {
          options.onComplete(result.originalName, result);
        }
      }
    }

    const totalTime = Date.now() - startTime;
    let message: string;

    if (failedUploads.length === 0) {
      message = `Alle ${files.length} Dateien erfolgreich hochgeladen.`;
    } else if (successfulUploads.length === 0) {
      message = `Alle ${files.length} Uploads fehlgeschlagen.`;
    } else {
      message = `${successfulUploads.length} von ${files.length} Dateien erfolgreich hochgeladen. ${failedUploads.length} fehlgeschlagen.`;
    }

    return {
      success: successfulUploads.length > 0,
      totalFiles: files.length,
      successfulUploads,
      failedUploads,
      message,
      uploadTime: totalTime,
    };
  }

  /**
   * Upload zum externen Server (pics.frank-sellke.de) mit Retry
   */
  private async uploadToRemote(
    file: File,
    fileName: string,
    options: {
      onProgress?: ProgressCallback;
      subfolder?: string;
    }
  ): Promise<UploadResult> {
    const maxRetries = UPLOAD_CONFIG.general.retryAttempts;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (options.onProgress) {
          options.onProgress({
            fileName,
            loaded: 0,
            total: file.size,
            percentage: 0,
            status: "uploading",
          });
        }

        const result = await this.attemptUpload(file, fileName, options);

        if (options.onProgress) {
          options.onProgress({
            fileName,
            loaded: file.size,
            total: file.size,
            percentage: 100,
            status: "completed",
          });
        }

        return result;
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error(String(error));
        console.warn(
          `Upload-Versuch ${attempt}/${maxRetries} fehlgeschlagen für ${fileName}:`,
          lastError.message
        );

        if (attempt < maxRetries) {
          const delay =
            UPLOAD_CONFIG.general.retryDelay * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Upload fehlgeschlagen nach allen Versuchen");
  }

  /**
   * Einzelner Upload-Versuch via Next.js API-Route
   * Die API-Route leitet dann weiter zu pics.frank-sellke.de
   */
  private async attemptUpload(
    file: File,
    fileName: string,
    options: { subfolder?: string }
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append("file", file, fileName);
    formData.append("target", this.targetKey);
    formData.append("fileName", fileName);
    if (options.subfolder) {
      formData.append("subfolder", options.subfolder);
    }

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();

    return {
      success: true,
      fileName,
      originalName: file.name,
      fileSize: file.size,
      fileUrl: result.fileUrl,
      thumbnailUrl: result.thumbnailUrl,
    };
  }
}

/**
 * Factory-Funktion
 */
export function createUploadManager(targetKey: string): UploadManager {
  return new UploadManager(targetKey);
}
