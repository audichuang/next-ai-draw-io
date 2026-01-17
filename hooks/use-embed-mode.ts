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
    const [isEmbedMode, setIsEmbedMode] = useState(false)
    const {
        loadDiagram,
        chartXML,
        latestSvg,
        exportCounter,
        isDrawioReady,
        handleExportWithoutHistory,
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
        setIsEmbedMode(embedMode)
    }, [])

    // Notify parent when DrawIO is ready
    useEffect(() => {
        if (!isEmbedMode) return
        if (!isDrawioReady) return
        if (hasNotifiedReadyRef.current) return

        hasNotifiedReadyRef.current = true
        notifyReady()
    }, [isEmbedMode, isDrawioReady])

    // Reset hasNotifiedReadyRef when isDrawioReady becomes false (e.g., on reload/retry)
    useEffect(() => {
        if (!isDrawioReady && hasNotifiedReadyRef.current) {
            hasNotifiedReadyRef.current = false
        }
    }, [isDrawioReady])

    // Use ref to store exportAndNotify so message handler can access it
    const exportAndNotifyRef = useRef<(() => Promise<void>) | null>(null)

    // Export diagram and notify parent
    const exportAndNotify = useCallback(async () => {
        // Use the existing export mechanism
        const svg = await new Promise<string>((resolve) => {
            pendingExportResolverRef.current = resolve
            handleExportWithoutHistory()
        })

        // svg is already in data:image/svg+xml;base64,... format from draw.io export
        // No need for additional encoding

        // Get chat history if available
        const chatHistory = options.getChatHistory?.() || ""

        // Use ref to get latest chartXML
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

            // Handle LOAD_DIAGRAM
            if (isLoadDiagramMessage(message)) {
                const { xml, chatHistory } = message.payload
                if (xml) {
                    // Skip validation for external diagrams (parent is trusted)
                    loadDiagram(xml, true)
                }
                // Notify about chat history if present
                if (chatHistory) {
                    options.onChatHistoryLoaded?.(chatHistory)
                }
            }

            // Handle REQUEST_EXPORT
            if (isRequestExportMessage(message)) {
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

        pendingExportResolverRef.current(latestSvg)
        pendingExportResolverRef.current = null
    }, [latestSvg, exportCounter])

    return {
        isEmbedMode,
        triggerSaveToParent,
    }
}
