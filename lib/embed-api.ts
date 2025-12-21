/**
 * Embed API for postMessage communication with parent window (e.g., Docmost)
 *
 * Protocol:
 * Parent → next-ai-draw-io:
 *   - LOAD_DIAGRAM: { type: 'LOAD_DIAGRAM', payload: { xml: string, chatHistory?: string } }
 *   - REQUEST_EXPORT: { type: 'REQUEST_EXPORT' }
 *
 * next-ai-draw-io → Parent:
 *   - READY: { type: 'READY' }
 *   - EXPORT_RESULT: { type: 'EXPORT_RESULT', payload: { xml: string, svg: string, chatHistory?: string } }
 *   - SAVE_REQUESTED: { type: 'SAVE_REQUESTED', payload: { xml: string, svg: string, chatHistory?: string } }
 */

export type EmbedMessageType =
    | "LOAD_DIAGRAM"
    | "REQUEST_EXPORT"
    | "READY"
    | "EXPORT_RESULT"
    | "SAVE_REQUESTED"

export interface EmbedMessage {
    type: EmbedMessageType
    payload?: {
        xml?: string
        svg?: string
        chatHistory?: string
    }
}

export interface LoadDiagramMessage extends EmbedMessage {
    type: "LOAD_DIAGRAM"
    payload: {
        xml: string
        chatHistory?: string
    }
}

export interface ExportResultMessage extends EmbedMessage {
    type: "EXPORT_RESULT" | "SAVE_REQUESTED"
    payload: {
        xml: string
        svg: string
        chatHistory?: string
    }
}

/**
 * Check if the current window is running in embed mode (inside an iframe)
 */
export function isEmbedMode(): boolean {
    if (typeof window === "undefined") return false
    // Check URL parameter
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get("embed") === "true"
}

/**
 * Check if we're running inside an iframe
 */
export function isInIframe(): boolean {
    if (typeof window === "undefined") return false
    try {
        const result = window.self !== window.top
        console.log("[NextAI embed-api] isInIframe check:", result)
        return result
    } catch (e) {
        // If we can't access window.top due to security, we're in a cross-origin iframe
        console.log(
            "[NextAI embed-api] isInIframe: caught error (cross-origin iframe)",
            e,
        )
        return true
    }
}

/**
 * Convert raw SVG string to base64 data URL (matching Drawio's format)
 * This ensures compatibility with Docmost's decodeBase64ToSvgString function
 */
export function svgToBase64DataUrl(svg: string): string {
    if (typeof window === "undefined") return svg
    // Handle UTF-8 characters properly
    const base64 = btoa(unescape(encodeURIComponent(svg)))
    return `data:image/svg+xml;base64,${base64}`
}

/**
 * Send a message to the parent window
 */
export function notifyParent(
    type: EmbedMessageType,
    payload?: EmbedMessage["payload"],
): void {
    if (typeof window === "undefined") return
    if (!isInIframe()) {
        console.log("[NextAI embed-api] notifyParent skipped: not in iframe")
        return
    }

    const message: EmbedMessage = { type, payload }
    console.log(
        "[NextAI embed-api] Sending message to parent:",
        type,
        payload ? "with payload" : "no payload",
    )

    // Use '*' for targetOrigin to allow any parent origin
    // In production, you may want to restrict this to specific origins
    window.parent.postMessage(message, "*")
}

/**
 * Notify parent that the embed is ready to receive commands
 */
export function notifyReady(): void {
    notifyParent("READY")
}

/**
 * Notify parent with export result (after REQUEST_EXPORT)
 */
export function notifyExportResult(
    xml: string,
    svg: string,
    chatHistory?: string,
): void {
    notifyParent("EXPORT_RESULT", { xml, svg, chatHistory })
}

/**
 * Notify parent that user wants to save (triggered by Save button in embed)
 */
export function notifySaveRequested(
    xml: string,
    svg: string,
    chatHistory?: string,
): void {
    notifyParent("SAVE_REQUESTED", { xml, svg, chatHistory })
}

/**
 * Type guard for LoadDiagramMessage
 */
export function isLoadDiagramMessage(
    message: unknown,
): message is LoadDiagramMessage {
    if (typeof message !== "object" || message === null) return false
    const msg = message as EmbedMessage
    return msg.type === "LOAD_DIAGRAM" && typeof msg.payload?.xml === "string"
}

/**
 * Type guard for REQUEST_EXPORT message
 */
export function isRequestExportMessage(message: unknown): boolean {
    if (typeof message !== "object" || message === null) return false
    const msg = message as EmbedMessage
    return msg.type === "REQUEST_EXPORT"
}
