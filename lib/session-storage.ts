import { nanoid } from "nanoid"
import { getApiEndpoint } from "./base-path"

// Constants
const MAX_TITLE_LENGTH = 100
const DEVICE_ID_KEY = "next-ai-drawio-device-id"

// Types
export interface ChatSession {
    id: string
    userId: string
    title: string
    createdAt: string
    updatedAt: string
    messages: StoredMessage[]
    xmlSnapshots: [number, string][]
    diagramXml: string | null
    thumbnailDataUrl?: string
    diagramHistory?: { svg: string; xml: string }[]
    messageCount: number
    hasDiagram: boolean
}

export interface StoredMessage {
    id: string
    role: "user" | "assistant" | "system"
    parts: Array<{ type: string; [key: string]: unknown }>
}

export interface SessionMetadata {
    id: string
    title: string
    createdAt: string
    updatedAt: string
    messageCount: number
    hasDiagram: boolean
    thumbnailDataUrl?: string
    folderId?: string | null
}

// Get or create device ID for anonymous users
export function getDeviceId(): string {
    if (typeof window === "undefined") return ""

    let deviceId = localStorage.getItem(DEVICE_ID_KEY)
    if (!deviceId) {
        deviceId = `device-${nanoid()}`
        localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }
    return deviceId
}

// Get user ID (access code if available, otherwise device ID)
export function getUserId(): string {
    if (typeof window === "undefined") return ""

    // Check for access code first
    const accessCode = localStorage.getItem("next-ai-draw-io-access-code")
    if (accessCode?.trim()) {
        return `access-${accessCode.trim()}`
    }

    // Fall back to device ID
    return getDeviceId()
}

// Check if DB storage is configured (has DATABASE_URL)
// In browser, we assume it's configured if API endpoints work
export function isDBStorageAvailable(): boolean {
    return typeof window !== "undefined"
}

// CRUD Operations via API
export async function getAllSessionMetadata(): Promise<SessionMetadata[]> {
    const userId = getUserId()
    if (!userId) return []

    try {
        const res = await fetch(
            getApiEndpoint(
                `/api/sessions?userId=${encodeURIComponent(userId)}`,
            ),
        )
        if (!res.ok) {
            // If API returns 500, DB might not be configured - fallback to empty
            console.warn("Sessions API unavailable, using empty list")
            return []
        }
        return await res.json()
    } catch (error) {
        console.error("Failed to get session metadata:", error)
        return []
    }
}

export async function getSession(id: string): Promise<ChatSession | null> {
    try {
        const res = await fetch(getApiEndpoint(`/api/sessions/${id}`))
        if (!res.ok) return null
        return await res.json()
    } catch (error) {
        console.error("Failed to get session:", error)
        return null
    }
}

export async function saveSession(
    session: Partial<ChatSession> & { id?: string },
): Promise<ChatSession | null> {
    const userId = getUserId()
    if (!userId) return null

    try {
        if (session.id) {
            // Update existing session
            const res = await fetch(
                getApiEndpoint(`/api/sessions/${session.id}`),
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(session),
                },
            )
            if (!res.ok) throw new Error("Failed to update session")
            return await res.json()
        } else {
            // Create new session
            const res = await fetch(getApiEndpoint("/api/sessions"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...session, userId }),
            })
            if (!res.ok) throw new Error("Failed to create session")
            return await res.json()
        }
    } catch (error) {
        console.error("Failed to save session:", error)
        return null
    }
}

export async function deleteSession(id: string): Promise<boolean> {
    try {
        const res = await fetch(getApiEndpoint(`/api/sessions/${id}`), {
            method: "DELETE",
        })
        return res.ok || res.status === 204
    } catch (error) {
        console.error("Failed to delete session:", error)
        return false
    }
}

// Helper: Create a new empty session via API (returns full session with ID)
export async function createEmptySession(): Promise<ChatSession | null> {
    const userId = getUserId()
    if (!userId) return null

    try {
        const res = await fetch(getApiEndpoint("/api/sessions"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId,
                title: "New Chat",
                messages: [],
                xmlSnapshots: [],
                diagramXml: null,
                messageCount: 0,
                hasDiagram: false,
            }),
        })
        if (!res.ok) throw new Error("Failed to create session")
        return await res.json()
    } catch (error) {
        console.error("Failed to create empty session:", error)
        return null
    }
}

// Rename a session
export async function renameSession(
    sessionId: string,
    newTitle: string,
): Promise<boolean> {
    try {
        const res = await fetch(getApiEndpoint(`/api/sessions/${sessionId}`), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle }),
        })
        return res.ok
    } catch (error) {
        console.error("Failed to rename session:", error)
        return false
    }
}

// Helper: Extract title from first user message (truncated to reasonable length)
export function extractTitle(messages: StoredMessage[]): string {
    const firstUserMessage = messages.find((m) => m.role === "user")
    if (!firstUserMessage) return "New Chat"

    const textPart = firstUserMessage.parts.find((p) => p.type === "text")
    if (!textPart || typeof textPart.text !== "string") return "New Chat"

    const text = textPart.text.trim()
    if (!text) return "New Chat"

    // Truncate long titles
    if (text.length > MAX_TITLE_LENGTH) {
        return text.slice(0, MAX_TITLE_LENGTH).trim() + "..."
    }
    return text
}

// Helper: Sanitize UIMessage to StoredMessage
export function sanitizeMessage(message: unknown): StoredMessage | null {
    if (!message || typeof message !== "object") return null

    const msg = message as Record<string, unknown>
    if (!msg.id || !msg.role) return null

    const role = msg.role as string
    if (!["user", "assistant", "system"].includes(role)) return null

    // Extract parts, removing streaming state artifacts
    let parts: Array<{ type: string; [key: string]: unknown }> = []
    if (Array.isArray(msg.parts)) {
        parts = msg.parts.map((part: unknown) => {
            if (!part || typeof part !== "object") return { type: "unknown" }
            const p = part as Record<string, unknown>
            // Remove streaming-related fields
            const { isStreaming, streamingState, ...cleanPart } = p
            return cleanPart as { type: string; [key: string]: unknown }
        })
    }

    return {
        id: msg.id as string,
        role: role as "user" | "assistant" | "system",
        parts,
    }
}

export function sanitizeMessages(messages: unknown[]): StoredMessage[] {
    return messages
        .map(sanitizeMessage)
        .filter((m): m is StoredMessage => m !== null)
}

// Legacy compatibility - these are no-ops now since we use API
export async function enforceSessionLimit(): Promise<void> {
    // No-op: server handles this
}

export async function getSessionCount(): Promise<number> {
    const sessions = await getAllSessionMetadata()
    return sessions.length
}

// Migration from localStorage/IndexedDB is no longer needed
// Old data will remain in browser storage but won't be used
export async function migrateFromLocalStorage(): Promise<string | null> {
    // No-op: migration not needed for API storage
    return null
}

// Legacy function - kept for compatibility
export function isIndexedDBAvailable(): boolean {
    return isDBStorageAvailable()
}

// Folder Types and CRUD Operations
export interface FolderMetadata {
    id: string
    name: string
    createdAt: string
    updatedAt: string
    sessionCount: number
}

export async function getAllFolders(): Promise<FolderMetadata[]> {
    const userId = getUserId()
    if (!userId) return []

    try {
        const res = await fetch(
            getApiEndpoint(`/api/folders?userId=${encodeURIComponent(userId)}`),
        )
        if (!res.ok) {
            console.warn("Folders API unavailable")
            return []
        }
        return await res.json()
    } catch (error) {
        console.error("Failed to get folders:", error)
        return []
    }
}

export async function createFolder(
    name: string,
): Promise<FolderMetadata | null> {
    const userId = getUserId()
    if (!userId) return null

    try {
        const res = await fetch(getApiEndpoint("/api/folders"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, name }),
        })
        if (!res.ok) throw new Error("Failed to create folder")
        return await res.json()
    } catch (error) {
        console.error("Failed to create folder:", error)
        return null
    }
}

export async function renameFolder(
    id: string,
    name: string,
): Promise<FolderMetadata | null> {
    try {
        const res = await fetch(getApiEndpoint(`/api/folders/${id}`), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        })
        if (!res.ok) throw new Error("Failed to rename folder")
        return await res.json()
    } catch (error) {
        console.error("Failed to rename folder:", error)
        return null
    }
}

export async function deleteFolder(id: string): Promise<boolean> {
    try {
        const res = await fetch(getApiEndpoint(`/api/folders/${id}`), {
            method: "DELETE",
        })
        return res.ok || res.status === 204
    } catch (error) {
        console.error("Failed to delete folder:", error)
        return false
    }
}

export async function moveSessionToFolder(
    sessionId: string,
    folderId: string | null,
): Promise<boolean> {
    try {
        const res = await fetch(getApiEndpoint(`/api/sessions/${sessionId}`), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId }),
        })
        return res.ok
    } catch (error) {
        console.error("Failed to move session to folder:", error)
        return false
    }
}
