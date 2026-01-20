"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
    type ChatSession,
    createEmptySession,
    createFolder as createFolderAPI,
    deleteFolder as deleteFolderAPI,
    deleteSession as deleteSessionFromAPI,
    extractTitle,
    // Folder imports
    type FolderMetadata,
    getAllFolders,
    getAllSessionMetadata,
    getSession,
    isDBStorageAvailable,
    moveSessionToFolder as moveSessionToFolderAPI,
    renameFolder as renameFolderAPI,
    type SessionMetadata,
    type StoredMessage,
    saveSession,
} from "@/lib/session-storage"

export interface SessionData {
    messages: StoredMessage[]
    xmlSnapshots: [number, string][]
    diagramXml: string | null
    thumbnailDataUrl?: string
    diagramHistory?: { svg: string; xml: string }[]
}

export interface UseSessionManagerReturn {
    // State
    sessions: SessionMetadata[]
    folders: FolderMetadata[]
    currentSessionId: string | null
    currentSession: ChatSession | null
    isLoading: boolean
    isAvailable: boolean

    // Actions
    switchSession: (id: string) => Promise<SessionData | null>
    deleteSession: (id: string) => Promise<{ wasCurrentSession: boolean }>
    // forSessionId: optional session ID to verify save targets correct session (prevents stale debounce writes)
    saveCurrentSession: (
        data: SessionData,
        forSessionId?: string | null,
    ) => Promise<void>
    refreshSessions: () => Promise<void>
    clearCurrentSession: () => void
    renameSession: (id: string, newTitle: string) => Promise<void>
    // Folder actions
    refreshFolders: () => Promise<void>
    createFolder: (name: string) => Promise<FolderMetadata | null>
    renameFolder: (id: string, newName: string) => Promise<void>
    deleteFolder: (id: string) => Promise<void>
    moveSessionToFolder: (
        sessionId: string,
        folderId: string | null,
    ) => Promise<void>
}

interface UseSessionManagerOptions {
    /** Session ID from URL param - if provided, load this session; if null, start blank */
    initialSessionId?: string | null
}

export function useSessionManager(
    options: UseSessionManagerOptions = {},
): UseSessionManagerReturn {
    const { initialSessionId } = options
    const [sessions, setSessions] = useState<SessionMetadata[]>([])
    const [folders, setFolders] = useState<FolderMetadata[]>([])
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(
        null,
    )
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(
        null,
    )
    const [isLoading, setIsLoading] = useState(true)
    const [isAvailable, setIsAvailable] = useState(false)

    const isInitializedRef = useRef(false)
    // Sequence guard for URL changes - prevents out-of-order async resolution
    const urlChangeSequenceRef = useRef(0)
    // Track last loaded session ID to prevent duplicate API calls
    const lastLoadedSessionIdRef = useRef<string | null>(null)

    // Load sessions list
    const refreshSessions = useCallback(async () => {
        if (!isDBStorageAvailable()) return
        try {
            const metadata = await getAllSessionMetadata()
            setSessions(metadata)
        } catch (error) {
            console.error("Failed to refresh sessions:", error)
        }
    }, [])

    // Initialize on mount
    useEffect(() => {
        if (isInitializedRef.current) return
        isInitializedRef.current = true

        async function init() {
            setIsLoading(true)

            if (!isDBStorageAvailable()) {
                setIsAvailable(false)
                setIsLoading(false)
                return
            }

            // Mark as loading BEFORE setIsAvailable to prevent second effect from loading
            if (initialSessionId) {
                lastLoadedSessionIdRef.current = initialSessionId
            }

            setIsAvailable(true)

            try {
                // Check for old IndexedDB data and clear if found
                const { hasOldIndexedDBData, clearOldIndexedDB } = await import(
                    "@/lib/indexeddb-migration"
                )
                const hasOldData = await hasOldIndexedDBData()

                if (hasOldData) {
                    console.log(
                        "[Session Manager] Found old IndexedDB data, skipping (migration no longer supported)",
                    )
                    // Clear old data without migrating
                    await clearOldIndexedDB()
                }

                // Load sessions list
                const metadata = await getAllSessionMetadata()
                setSessions(metadata)

                // Load folders list
                const folderList = await getAllFolders()
                setFolders(folderList)

                // Only load a session if initialSessionId is provided (from URL param)
                if (initialSessionId) {
                    const session = await getSession(initialSessionId)
                    if (session) {
                        setCurrentSession(session)
                        setCurrentSessionId(session.id)
                    }
                    // If session not found, stay in blank state (URL has invalid session ID)
                }
                // If no initialSessionId, start with blank state (no auto-restore)
            } catch (error) {
                console.error("Failed to initialize session manager:", error)
            } finally {
                setIsLoading(false)
            }
        }

        init()
    }, [initialSessionId])

    // Handle URL session ID changes after initialization
    // Note: intentionally NOT including currentSessionId in deps to avoid race conditions
    // when clearCurrentSession() is called before URL updates
    useEffect(() => {
        if (!isInitializedRef.current) return // Wait for initial load
        if (!isAvailable) return

        // Skip if we already loaded this session ID
        if (initialSessionId === lastLoadedSessionIdRef.current) return

        // Increment sequence to invalidate any pending async operations
        urlChangeSequenceRef.current++
        const currentSequence = urlChangeSequenceRef.current

        async function handleSessionIdChange() {
            if (initialSessionId) {
                // Mark as loading to prevent duplicate requests
                lastLoadedSessionIdRef.current = initialSessionId

                // URL has session ID - load it
                const session = await getSession(initialSessionId)

                // Check if this request is still the latest (sequence guard)
                // If not, a newer URL change happened while we were loading
                if (currentSequence !== urlChangeSequenceRef.current) {
                    return
                }

                if (session) {
                    // Only update if the session is different from current
                    setCurrentSessionId((current) => {
                        if (current !== session.id) {
                            setCurrentSession(session)
                            return session.id
                        }
                        return current
                    })
                }
            }
            // Removed: else clause that clears session
            // Clearing is now handled explicitly by clearCurrentSession()
            // This prevents race conditions when URL update is async
        }

        handleSessionIdChange()
    }, [initialSessionId, isAvailable])

    // Refresh sessions on window focus (multi-tab sync)
    useEffect(() => {
        const handleFocus = () => {
            refreshSessions()
        }
        window.addEventListener("focus", handleFocus)
        return () => window.removeEventListener("focus", handleFocus)
    }, [refreshSessions])

    // Switch to a different session
    const switchSession = useCallback(
        async (id: string): Promise<SessionData | null> => {
            if (id === currentSessionId) return null

            // Save current session first if it has messages
            if (currentSession && currentSession.messages.length > 0) {
                await saveSession(currentSession)
            }

            // Load the target session
            const session = await getSession(id)
            if (!session) {
                console.error("Session not found:", id)
                return null
            }

            // Update state
            setCurrentSession(session)
            setCurrentSessionId(session.id)

            return {
                messages: session.messages,
                xmlSnapshots: session.xmlSnapshots,
                diagramXml: session.diagramXml,
                thumbnailDataUrl: session.thumbnailDataUrl,
                diagramHistory: session.diagramHistory,
            }
        },
        [currentSessionId, currentSession],
    )

    // Delete a session
    const deleteSession = useCallback(
        async (id: string): Promise<{ wasCurrentSession: boolean }> => {
            const wasCurrentSession = id === currentSessionId
            await deleteSessionFromAPI(id)

            // If deleting current session, clear state (caller will show new empty session)
            if (wasCurrentSession) {
                setCurrentSession(null)
                setCurrentSessionId(null)
            }

            await refreshSessions()

            return { wasCurrentSession }
        },
        [currentSessionId, refreshSessions],
    )

    // Save current session data (debounced externally by caller)
    // forSessionId: if provided, verify save targets correct session (prevents stale debounce writes)
    const saveCurrentSession = useCallback(
        async (
            data: SessionData,
            forSessionId?: string | null,
        ): Promise<void> => {
            // If forSessionId is provided, verify it matches current session
            // This prevents stale debounced saves from overwriting a newly switched session
            if (
                forSessionId !== undefined &&
                forSessionId !== currentSessionId
            ) {
                return
            }

            if (!currentSession) {
                // Create a new session if none exists
                const newSessionData = {
                    ...createEmptySession(),
                    messages: data.messages,
                    xmlSnapshots: data.xmlSnapshots,
                    diagramXml: data.diagramXml,
                    thumbnailDataUrl: data.thumbnailDataUrl,
                    diagramHistory: data.diagramHistory,
                    title: extractTitle(data.messages),
                }
                const newSession = await saveSession(newSessionData)
                if (newSession) {
                    setCurrentSession(newSession)
                    setCurrentSessionId(newSession.id)
                    await refreshSessions()
                }
                return
            }

            // Update existing session
            const updatedSession = await saveSession({
                id: currentSession.id,
                messages: data.messages,
                xmlSnapshots: data.xmlSnapshots,
                diagramXml: data.diagramXml,
                thumbnailDataUrl:
                    data.thumbnailDataUrl ?? currentSession.thumbnailDataUrl,
                diagramHistory:
                    data.diagramHistory ?? currentSession.diagramHistory,
                // Update title if it's still default and we have messages
                title:
                    currentSession.title === "New Chat" &&
                    data.messages.length > 0
                        ? extractTitle(data.messages)
                        : currentSession.title,
            })

            if (updatedSession) {
                setCurrentSession(updatedSession)

                // Update sessions list metadata
                setSessions((prev) =>
                    prev.map((s) =>
                        s.id === updatedSession.id
                            ? {
                                  ...s,
                                  title: updatedSession.title,
                                  updatedAt: updatedSession.updatedAt,
                                  messageCount: updatedSession.messageCount,
                                  hasDiagram: updatedSession.hasDiagram,
                                  thumbnailDataUrl:
                                      updatedSession.thumbnailDataUrl,
                              }
                            : s,
                    ),
                )
            }
        },
        [currentSession, currentSessionId, refreshSessions],
    )

    // Rename a session
    const renameSession = useCallback(
        async (id: string, newTitle: string): Promise<void> => {
            const updatedSession = await saveSession({
                id,
                title: newTitle,
            })

            if (updatedSession) {
                // Update sessions list metadata
                setSessions((prev) =>
                    prev.map((s) =>
                        s.id === updatedSession.id
                            ? {
                                  ...s,
                                  title: updatedSession.title,
                                  updatedAt: updatedSession.updatedAt,
                              }
                            : s,
                    ),
                )

                // If this is the current session, update it too
                if (currentSessionId === id && currentSession) {
                    setCurrentSession({
                        ...currentSession,
                        title: updatedSession.title,
                    })
                }
            }
        },
        [currentSessionId, currentSession],
    )

    // Clear current session state (for starting fresh without loading another session)
    const clearCurrentSession = useCallback(() => {
        setCurrentSession(null)
        setCurrentSessionId(null)
    }, [])

    // ===== FOLDER ACTIONS =====

    // Load folders list
    const refreshFolders = useCallback(async () => {
        if (!isDBStorageAvailable()) return
        try {
            const folderList = await getAllFolders()
            setFolders(folderList)
        } catch (error) {
            console.error("Failed to refresh folders:", error)
        }
    }, [])

    // Create a new folder
    const createFolder = useCallback(
        async (name: string): Promise<FolderMetadata | null> => {
            const newFolder = await createFolderAPI(name)
            if (newFolder) {
                setFolders((prev) =>
                    [...prev, newFolder].sort((a, b) =>
                        a.name.localeCompare(b.name),
                    ),
                )
            }
            return newFolder
        },
        [],
    )

    // Rename a folder
    const renameFolder = useCallback(
        async (id: string, newName: string): Promise<void> => {
            const updated = await renameFolderAPI(id, newName)
            if (updated) {
                setFolders((prev) =>
                    prev
                        .map((f) =>
                            f.id === id ? { ...f, name: updated.name } : f,
                        )
                        .sort((a, b) => a.name.localeCompare(b.name)),
                )
            }
        },
        [],
    )

    // Delete a folder (sessions move to uncategorized)
    const deleteFolder = useCallback(async (id: string): Promise<void> => {
        const success = await deleteFolderAPI(id)
        if (success) {
            setFolders((prev) => prev.filter((f) => f.id !== id))
        }
    }, [])

    // Move a session to a folder
    const moveSessionToFolder = useCallback(
        async (sessionId: string, folderId: string | null): Promise<void> => {
            const success = await moveSessionToFolderAPI(sessionId, folderId)
            if (success) {
                // Refresh folders to update session counts
                await refreshFolders()
                // Refresh sessions to update folderId
                await refreshSessions()
            }
        },
        [refreshFolders, refreshSessions],
    )

    return {
        sessions,
        folders,
        currentSessionId,
        currentSession,
        isLoading,
        isAvailable,
        switchSession,
        deleteSession,
        saveCurrentSession,
        refreshSessions,
        clearCurrentSession,
        renameSession,
        // Folder actions
        refreshFolders,
        createFolder,
        renameFolder,
        deleteFolder,
        moveSessionToFolder,
    }
}
