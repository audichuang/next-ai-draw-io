"use client"

import { useCallback, useEffect, useRef } from "react"

interface UseEmbedChatHistoryOptions {
    /** Whether running in embed mode */
    isEmbedMode: boolean
    /** Initial chat history JSON from parent */
    initialChatHistory?: string
    /** Function to set messages (from useChat) */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setMessages: (messages: any[]) => void
    /** Ref to XML snapshots map */
    xmlSnapshotsRef: React.MutableRefObject<Map<number, string>>
}

interface UseEmbedChatHistoryReturn {
    /** Reset loaded history tracking (call when starting new chat) */
    resetLoadedHistory: () => void
}

/**
 * Hook to handle chat history loading in embed mode.
 *
 * This solves the race condition where initialChatHistory arrives
 * asynchronously via postMessage after the component's first render.
 *
 * Usage in chat-panel.tsx:
 * ```
 * const { resetLoadedHistory } = useEmbedChatHistory({
 *     isEmbedMode,
 *     initialChatHistory,
 *     setMessages,
 *     xmlSnapshotsRef,
 * })
 *
 * // In handleNewChat:
 * resetLoadedHistory()
 * ```
 */
export function useEmbedChatHistory({
    isEmbedMode,
    initialChatHistory,
    setMessages,
    xmlSnapshotsRef,
}: UseEmbedChatHistoryOptions): UseEmbedChatHistoryReturn {
    // Track loaded chat history to prevent duplicate loads
    const loadedChatHistoryRef = useRef<string>("")

    // Handle chat history loading in embed mode (async via postMessage)
    // This is separate from localStorage restore because initialChatHistory arrives after first render
    useEffect(() => {
        // Only handle embed mode
        if (!isEmbedMode) return

        // No chat history or already loaded the same one
        if (!initialChatHistory) return
        if (initialChatHistory === loadedChatHistoryRef.current) return

        try {
            const parsed = JSON.parse(initialChatHistory)
            if (parsed.messages && Array.isArray(parsed.messages)) {
                setMessages(parsed.messages)
            }
            if (parsed.xmlSnapshots) {
                xmlSnapshotsRef.current = new Map(parsed.xmlSnapshots)
            }
            loadedChatHistoryRef.current = initialChatHistory
            console.log(
                "[NextAI useEmbedChatHistory] Loaded chat history from parent, messages:",
                parsed.messages?.length,
            )
        } catch (error) {
            console.error(
                "[NextAI useEmbedChatHistory] Failed to parse initialChatHistory:",
                error,
            )
        }
    }, [isEmbedMode, initialChatHistory, setMessages, xmlSnapshotsRef])

    // Reset function for when starting a new chat
    const resetLoadedHistory = useCallback(() => {
        loadedChatHistoryRef.current = ""
    }, [])

    return { resetLoadedHistory }
}
