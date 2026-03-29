/**
 * FranksFotos – Upload-Konfiguration
 * Adaptiert von brueckenweb /lib/upload/config.ts
 * Ziel-Domain: https://pics.frank-sellke.de
 */

export interface UploadTarget {
  remote: string;
  thumbnailPath?: string;
  maxSize: number;
  allowedTypes: string[];
  allowedExtensions: string[];
  requiresAuth: boolean;
  requiresPermission?: string;
}

export interface UploadConfig {
  targets: {
    [key: string]: UploadTarget;
  };
  general: {
    maxConcurrentUploads: number;
    retryAttempts: number;
    retryDelay: number;
    chunkSize: number;
    timeoutMs: number;
  };
  baseUrl: string;
  phpEndpoint: string;
}

const BASE_URL = process.env.UPLOAD_DOMAIN || "https://pics.frank-sellke.de";
const PHP_ENDPOINT = process.env.UPLOAD_PHP_ENDPOINT || `${BASE_URL}/upload.php`;

export const UPLOAD_CONFIG: UploadConfig = {
  baseUrl: BASE_URL,
  phpEndpoint: PHP_ENDPOINT,

  targets: {
    // Original-Fotos
    photos: {
      remote: `${BASE_URL}/fotos/`,
      thumbnailPath: `${BASE_URL}/thumbs/`,
      maxSize: 50 * 1024 * 1024, // 50MB
      allowedTypes: [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/tiff",
        "image/heic",
      ],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".tiff", ".heic"],
      requiresAuth: true,
      requiresPermission: "upload_photos",
    },

    // Videos
    videos: {
      remote: `${BASE_URL}/videos/`,
      thumbnailPath: `${BASE_URL}/video-thumbs/`,
      maxSize: 500 * 1024 * 1024, // 500MB
      allowedTypes: [
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
        "video/webm",
        "video/x-matroska",
      ],
      allowedExtensions: [".mp4", ".mov", ".avi", ".webm", ".mkv"],
      requiresAuth: true,
      requiresPermission: "upload_videos",
    },

    // Video-Thumbnails (client-seitig generiert, als JPEG hochgeladen)
    videoThumbnails: {
      remote: `${BASE_URL}/video-thumbs/`,
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ["image/jpeg", "image/png", "image/webp"],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
      requiresAuth: true,
      requiresPermission: "upload_videos",
    },

    // Avatare
    avatars: {
      remote: `${BASE_URL}/avatars/`,
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ["image/jpeg", "image/png", "image/webp"],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
      requiresAuth: true,
    },
  },

  general: {
    maxConcurrentUploads: 3,
    retryAttempts: 3,
    retryDelay: 1000,
    chunkSize: 2 * 1024 * 1024, // 2MB Chunks
    timeoutMs: 60000, // 60 Sekunden
  },
};

/**
 * Hilfsfunktionen für Upload-Konfiguration
 */
export class UploadConfigHelper {
  /**
   * Validiert eine Datei gegen die Konfiguration
   */
  static validateFile(
    file: { name: string; size: number; type: string },
    targetKey: string
  ): { valid: boolean; error?: string } {
    const target = UPLOAD_CONFIG.targets[targetKey];
    if (!target) {
      return { valid: false, error: `Unbekanntes Upload-Ziel: ${targetKey}` };
    }

    if (file.size > target.maxSize) {
      const maxSizeMB = Math.round(target.maxSize / (1024 * 1024));
      return {
        valid: false,
        error: `Datei zu groß. Maximum: ${maxSizeMB}MB`,
      };
    }

    if (!target.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Dateityp nicht erlaubt. Erlaubt: ${target.allowedExtensions.join(", ")}`,
      };
    }

    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!target.allowedExtensions.includes(fileExtension)) {
      return {
        valid: false,
        error: `Dateiendung nicht erlaubt. Erlaubt: ${target.allowedExtensions.join(", ")}`,
      };
    }

    return { valid: true };
  }

  /**
   * Bereinigt einen Dateinamen für sichere Verwendung
   */
  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.\-_]/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }

  /**
   * Generiert einen eindeutigen Dateinamen
   */
  static generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    // Extension lowercase damit DB-URL und tatsächlicher Dateiname (PHP lowercased) übereinstimmen
    const extension = (originalName.split(".").pop() ?? "bin").toLowerCase();
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
    const sanitizedName = this.sanitizeFilename(nameWithoutExt);
    return `${sanitizedName}_${timestamp}_${randomSuffix}.${extension}`;
  }

  /**
   * Gibt die vollständige URL für eine hochgeladene Datei zurück
   */
  static getFileUrl(filename: string, targetKey: string): string {
    const target = UPLOAD_CONFIG.targets[targetKey];
    if (!target) throw new Error(`Unbekanntes Upload-Ziel: ${targetKey}`);
    return target.remote + filename;
  }

  /**
   * Gibt die Thumbnail-URL zurück
   */
  static getThumbnailUrl(filename: string, targetKey: string): string | null {
    const target = UPLOAD_CONFIG.targets[targetKey];
    if (!target?.thumbnailPath) return null;
    const thumbName = filename.replace(/\.[^/.]+$/, "_thumb.jpg");
    return target.thumbnailPath + thumbName;
  }
}
