"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDiagram } from "@/contexts/diagram-context"
import {
    isEmbedMode as checkEmbedMode,
    type EmbedMessage,
    isLoadDiagramMessage,
    isRequestExportMessage,
    notifyExportResult,
    notifyReady,
    notifySaveRequested,
} from "@/lib/embed-api"

interface UseEmbedModeOptions {
    /** Called when parent requests to save and close */
    onSaveAndClose?: () => void
    /** Called when parent sends chat history */
    onChatHistoryLoaded?: (chatHistory: string) => void
    /** Get current chat history for export */
    getChatHistory?: () => string
}

interface UseEmbedModeReturn {
    /** Whether we're running in embed mode */
    isEmbedMode: boolean
    /** Trigger save to parent (calls SAVE_REQUESTED) */
    triggerSaveToParent: () => Promise<void>
}

/**
 * Hook to handle embed mode communication with parent window
 *
 * When in embed mode:
 * - Notifies parent when ready
 * - Listens for LOAD_DIAGRAM to load external diagrams
 * - Listens for REQUEST_EXPORT to export current diagram
 * - Provides triggerSaveToParent to send diagram back to parent
 */
export function useEmbedMode(
    options: UseEmbedModeOptions = {},
): UseEmbedModeReturn {
    // Debug: Log when hook is called
    console.log("[NextAI useEmbedMode] Hook called")

    const [isEmbedMode, setIsEmbedMode] = useState(false)
    const {
        loadDiagram,
        chartXML,
        latestSvg,
        exportCounter,
        isDrawioReady,
        handleExportWithoutHistory,
        resolverRef,
    } = useDiagram()
    const hasNotifiedReadyRef = useRef(false)
    const pendingExportResolverRef = useRef<((svg: string) => void) | null>(
        null,
    )
    // Use ref to avoid stale closure in message handler
    const chartXMLRef = useRef(chartXML)

    // Keep ref in sync
    useEffect(() => {
        chartXMLRef.current = chartXML
    }, [chartXML])

    // Check embed mode on mount
    useEffect(() => {
        const embedMode = checkEmbedMode()
        console.log("[NextAI useEmbedMode] Checking embed mode:", embedMode)
        setIsEmbedMode(embedMode)
    }, [])

    // Notify parent when DrawIO is ready
    useEffect(() => {
        if (!isEmbedMode) return
        if (!isDrawioReady) return
        if (hasNotifiedReadyRef.current) return

        hasNotifiedReadyRef.current = true
        console.log("[NextAI] DrawIO ready, notifying parent")
        notifyReady()
    }, [isEmbedMode, isDrawioReady])

    // Use ref to store exportAndNotify so message handler can access it
    const exportAndNotifyRef = useRef<(() => Promise<void>) | null>(null)

    // Export diagram and notify parent
    const exportAndNotify = useCallback(async () => {
        console.log("[NextAI] exportAndNotify called")
        console.log("[NextAI] chartXML length:", chartXMLRef.current?.length)

        // Use the existing export mechanism
        const svg = await new Promise<string>((resolve) => {
            console.log("[NextAI] Setting up pending export resolver")
            pendingExportResolverRef.current = resolve
            handleExportWithoutHistory()
        })

        console.log("[NextAI] Export complete, svg length:", svg?.length)

        // svg is already in data:image/svg+xml;base64,... format from draw.io export
        // No need for additional encoding

        // Get chat history if available
        const chatHistory = options.getChatHistory?.() || ""

        // Use ref to get latest chartXML
        console.log(
            "[NextAI] Sending EXPORT_RESULT to parent with SVG data URL",
        )
        notifyExportResult(chartXMLRef.current, svg, chatHistory)
    }, [handleExportWithoutHistory, options])

    // Keep ref in sync
    useEffect(() => {
        exportAndNotifyRef.current = exportAndNotify
    }, [exportAndNotify])

    // Handle messages from parent
    useEffect(() => {
        if (!isEmbedMode) return

        const handleMessage = (event: MessageEvent) => {
            const message = event.data as EmbedMessage

            // Log all incoming messages in embed mode
            if (message && typeof message.type === "string") {
                console.log("[NextAI] Received message:", message.type)
            }

            // Handle LOAD_DIAGRAM
            if (isLoadDiagramMessage(message)) {
                console.log(
                    "[NextAI] Handling LOAD_DIAGRAM, xml length:",
                    message.payload?.xml?.length,
                )
                const { xml, chatHistory } = message.payload
                if (xml) {
                    // Skip validation for external diagrams (parent is trusted)
                    loadDiagram(xml, true)
                }
                // Notify about chat history if present
                if (chatHistory) {
                    console.log(
                        "[NextAI] Received chatHistory, length:",
                        chatHistory.length,
                    )
                    options.onChatHistoryLoaded?.(chatHistory)
                }
            }

            // Handle REQUEST_EXPORT
            if (isRequestExportMessage(message)) {
                console.log("[NextAI] Handling REQUEST_EXPORT")
                console.log(
                    "[NextAI] exportAndNotifyRef.current:",
                    !!exportAndNotifyRef.current,
                )
                // Export current diagram and send to parent
                exportAndNotifyRef.current?.()
            }
        }

        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [isEmbedMode, loadDiagram])

    // Save to parent (triggered by save button in embed mode)
    const triggerSaveToParent = useCallback(async () => {
        if (!isEmbedMode) return

        // Get latest SVG export
        const svg = await new Promise<string>((resolve) => {
            pendingExportResolverRef.current = resolve
            handleExportWithoutHistory()
        })

        // svg is already in data:image/svg+xml;base64,... format from draw.io export
        // No need for additional encoding

        // Get chat history if available
        const chatHistory = options.getChatHistory?.() || ""

        // Use ref to get latest chartXML
        notifySaveRequested(chartXMLRef.current, svg, chatHistory)
        options.onSaveAndClose?.()
    }, [isEmbedMode, handleExportWithoutHistory, options])

    // Hook into diagram export to resolve pending exports
    // Using exportCounter ensures this triggers even if SVG content is the same
    useEffect(() => {
        if (!pendingExportResolverRef.current) return
        if (!latestSvg) return

        console.log(
            "[NextAI] latestSvg updated, resolving pending export, svg length:",
            latestSvg?.length,
        )
        pendingExportResolverRef.current(latestSvg)
        pendingExportResolverRef.current = null
    }, [latestSvg, exportCounter])

    return {
        isEmbedMode,
        triggerSaveToParent,
    }
}
