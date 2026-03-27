/**
 * FranksFotos – Berechtigungssystem
 * Zentrale Definitionen und Helper-Funktionen für das Rechte-System
 */

// ============================================================
// BEKANNTE RECHTE (als Konstanten)
// ============================================================

export const PERMISSIONS = {
  // Medien
  UPLOAD_PHOTOS: "upload_photos",
  UPLOAD_VIDEOS: "upload_videos",
  DELETE_MEDIA: "delete_media",
  EDIT_MEDIA_INFO: "edit_media_info",
  ASSIGN_ALBUMS: "assign_albums",

  // Alben
  MANAGE_ALBUMS: "manage_albums",
  CREATE_TAGS: "create_tags",

  // Sichtbarkeit
  VIEW_PRIVATE: "view_private",

  // Admin
  MANAGE_USERS: "manage_users",
  MANAGE_PERMISSIONS: "manage_permissions",
  MANAGE_GROUPS: "manage_groups",
  VIEW_ADMIN: "view_admin",

  // Social
  COMMENT: "comment",
  LIKE: "like",

  // Downloads
  DOWNLOAD_ORIGINAL: "download_original",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export type PermissionValue = (typeof PERMISSIONS)[PermissionKey];

// ============================================================
// STANDARD-GRUPPEN-RECHTE
// ============================================================

export const DEFAULT_GROUP_PERMISSIONS: Record<string, PermissionValue[]> = {
  admin: Object.values(PERMISSIONS),     // Admin hat alle Rechte
  user: [
    PERMISSIONS.COMMENT,
    PERMISSIONS.LIKE,
    PERMISSIONS.DOWNLOAD_ORIGINAL,
  ],
  familie: [
    PERMISSIONS.COMMENT,
    PERMISSIONS.LIKE,
    PERMISSIONS.DOWNLOAD_ORIGINAL,
    PERMISSIONS.UPLOAD_PHOTOS,
    PERMISSIONS.UPLOAD_VIDEOS,
  ],
  public: [
    // Öffentliche Gruppe hat keine expliziten Rechte (nur Lesezugriff)
  ],
};

// ============================================================
// ALLE RECHTE MIT METADATEN (für Admin-UI)
// ============================================================

export interface PermissionDefinition {
  name: PermissionValue;
  label: string;
  description: string;
  category: "media" | "albums" | "admin" | "social" | "download";
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // Medien
  {
    name: PERMISSIONS.UPLOAD_PHOTOS,
    label: "Fotos hochladen",
    description: "Erlaubt das Hochladen von Fotos",
    category: "media",
  },
  {
    name: PERMISSIONS.UPLOAD_VIDEOS,
    label: "Videos hochladen",
    description: "Erlaubt das Hochladen von Videos",
    category: "media",
  },
  {
    name: PERMISSIONS.DELETE_MEDIA,
    label: "Medien löschen",
    description: "Erlaubt das Löschen von Fotos und Videos",
    category: "media",
  },
  {
    name: PERMISSIONS.EDIT_MEDIA_INFO,
    label: "Medien bearbeiten",
    description: "Erlaubt das Bearbeiten von Titel, Beschreibung und Tags",
    category: "media",
  },
  {
    name: PERMISSIONS.ASSIGN_ALBUMS,
    label: "Alben zuweisen",
    description: "Erlaubt das Zuweisen von Medien zu Alben",
    category: "albums",
  },
  // Alben
  {
    name: PERMISSIONS.MANAGE_ALBUMS,
    label: "Alben verwalten",
    description: "Erlaubt das Anlegen, Bearbeiten und Löschen von Alben",
    category: "albums",
  },
  {
    name: PERMISSIONS.CREATE_TAGS,
    label: "Tags anlegen",
    description: "Erlaubt das Anlegen neuer Tags",
    category: "albums",
  },
  // Sichtbarkeit
  {
    name: PERMISSIONS.VIEW_PRIVATE,
    label: "Private Medien sehen",
    description: "Erlaubt das Anzeigen von privaten Medien (wenn zugewiesen)",
    category: "media",
  },
  // Admin
  {
    name: PERMISSIONS.VIEW_ADMIN,
    label: "Admin-Bereich sehen",
    description: "Erlaubt den Zugriff auf den Admin-Bereich",
    category: "admin",
  },
  {
    name: PERMISSIONS.MANAGE_USERS,
    label: "Benutzer verwalten",
    description: "Erlaubt das Anlegen und Bearbeiten von Benutzern",
    category: "admin",
  },
  {
    name: PERMISSIONS.MANAGE_GROUPS,
    label: "Gruppen verwalten",
    description: "Erlaubt das Anlegen und Bearbeiten von Gruppen",
    category: "admin",
  },
  {
    name: PERMISSIONS.MANAGE_PERMISSIONS,
    label: "Rechte vergeben",
    description: "Erlaubt das Vergeben von Rechten an Gruppen und User",
    category: "admin",
  },
  // Social
  {
    name: PERMISSIONS.COMMENT,
    label: "Kommentieren",
    description: "Erlaubt das Schreiben von Kommentaren",
    category: "social",
  },
  {
    name: PERMISSIONS.LIKE,
    label: "Liken",
    description: "Erlaubt das Vergeben von Likes",
    category: "social",
  },
  // Download
  {
    name: PERMISSIONS.DOWNLOAD_ORIGINAL,
    label: "Original herunterladen",
    description: "Erlaubt den Download der Originalbilder (mit Wasserzeichen)",
    category: "download",
  },
];

// ============================================================
// SESSION-TYPEN (TypeScript-Erweiterung)
// ============================================================

export interface FranksSession {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string;
    isMainAdmin: boolean;
    groups: string[];
    permissions: string[];
  };
}

// ============================================================
// HELPER-FUNKTIONEN
// ============================================================

/**
 * Prüft ob ein User ein bestimmtes Recht hat
 */
export function hasPermission(
  userPermissions: string[],
  permission: PermissionValue
): boolean {
  if (!userPermissions) return false;
  // Wildcard: Hauptadmin hat alle Rechte
  if (userPermissions.includes("*")) return true;
  return userPermissions.includes(permission);
}

/**
 * Prüft ob ein User in einer bestimmten Gruppe ist
 */
export function isInGroup(userGroups: string[], groupSlug: string): boolean {
  if (!userGroups) return false;
  return userGroups.includes(groupSlug);
}

/**
 * Prüft ob ein User Admin-Rechte hat
 */
export function isAdmin(userPermissions: string[], isMainAdmin: boolean): boolean {
  if (isMainAdmin) return true;
  return hasPermission(userPermissions, PERMISSIONS.VIEW_ADMIN);
}
