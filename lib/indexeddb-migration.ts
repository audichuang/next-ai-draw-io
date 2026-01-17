/**
 * IndexedDB Migration Utilities
 * Used to migrate data from old IndexedDB storage to new PostgreSQL API
 */

import { type IDBPDatabase, openDB } from "idb"
import { getApiEndpoint } from "./base-path"

const DB_NAME = "next-ai-drawio"
const DB_VERSION = 1
const STORE_NAME = "sessions"

interface OldChatSession {
    id: string
    title: string
    createdAt: number
    updatedAt: number
    messages: unknown[]
    xmlSnapshots: [number, string][]
    diagramXml: string
    thumbnailDataUrl?: string
    diagramHistory?: { svg: string; xml: string }[]
}

// Check if IndexedDB is available
function isIndexedDBAvailable(): boolean {
    if (typeof window === "undefined") return false
    try {
        return "indexedDB" in window && window.indexedDB !== null
    } catch {
        return false
    }
}

// Open old IndexedDB
async function getOldDB(): Promise<IDBPDatabase | null> {
    if (!isIndexedDBAvailable()) return null
    try {
        return await openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, {
                        keyPath: "id",
                    })
                    store.createIndex("by-updated", "updatedAt")
                }
            },
        })
    } catch {
        return null
    }
}

// Get all sessions from old IndexedDB
export async function getOldIndexedDBSessions(): Promise<OldChatSession[]> {
    const db = await getOldDB()
    if (!db) return []

    try {
        const tx = db.transaction(STORE_NAME, "readonly")
        const index = tx.store.index("by-updated")
        const sessions: OldChatSession[] = []

        let cursor = await index.openCursor(null, "prev")
        while (cursor) {
            sessions.push(cursor.value as OldChatSession)
            cursor = await cursor.continue()
        }

        return sessions
    } catch (error) {
        console.error("Failed to read old IndexedDB:", error)
        return []
    }
}

// Check if there are sessions in old IndexedDB
export async function hasOldIndexedDBData(): Promise<boolean> {
    const db = await getOldDB()
    if (!db) return false

    try {
        const count = await db.count(STORE_NAME)
        return count > 0
    } catch {
        return false
    }
}

// Migrate a single session to PostgreSQL
async function migrateSession(
    session: OldChatSession,
    userId: string,
): Promise<boolean> {
    try {
        const res = await fetch(getApiEndpoint("/api/sessions"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId,
                title: session.title,
                messages: session.messages,
                xmlSnapshots: session.xmlSnapshots,
                diagramXml: session.diagramXml,
                diagramHistory: session.diagramHistory,
                thumbnailDataUrl: session.thumbnailDataUrl,
            }),
        })
        return res.ok
    } catch (error) {
        console.error("Failed to migrate session:", session.id, error)
        return false
    }
}

// Migrate all sessions from IndexedDB to PostgreSQL
export async function migrateIndexedDBToPostgres(userId: string): Promise<{
    total: number
    migrated: number
    failed: number
}> {
    const sessions = await getOldIndexedDBSessions()

    let migrated = 0
    let failed = 0

    for (const session of sessions) {
        const success = await migrateSession(session, userId)
        if (success) {
            migrated++
        } else {
            failed++
        }
    }

    return {
        total: sessions.length,
        migrated,
        failed,
    }
}

// Clear old IndexedDB after successful migration
export async function clearOldIndexedDB(): Promise<boolean> {
    const db = await getOldDB()
    if (!db) return false

    try {
        await db.clear(STORE_NAME)
        return true
    } catch (error) {
        console.error("Failed to clear old IndexedDB:", error)
        return false
    }
}
