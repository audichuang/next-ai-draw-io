"use client"

import type React from "react"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { DrawIoEmbedRef } from "react-drawio"
import { toast } from "sonner"
import type { ExportFormat } from "@/components/save-dialog"
import { getApiEndpoint } from "@/lib/base-path"
import { isEmbedMode } from "@/lib/embed-api"
import {
    extractDiagramXML,
    isRealDiagram,
    validateAndFixXml,
} from "../lib/utils"

// localStorage key for diagram XML persistence
const STORAGE_DIAGRAM_XML_KEY = "next-ai-draw-io-diagram-xml"

interface DiagramContextType {
    chartXML: string
    latestSvg: string
    exportCounter: number // Counter to force useEffect trigger
    diagramHistory: { svg: string; xml: string }[]
    setDiagramHistory: (history: { svg: string; xml: string }[]) => void
    loadDiagram: (
        chart: string,
        skipValidation?: boolean,
        saveToHistory?: boolean,
    ) => string | null
    handleExport: () => void
    handleExportWithoutHistory: () => void
    resolverRef: React.Ref<((value: string) => void) | null>
    drawioRef: React.Ref<DrawIoEmbedRef | null>
    handleDiagramExport: (data: any) => void
    clearDiagram: () => void
    saveDiagramToFile: (
        filename: string,
        format: ExportFormat,
        sessionId?: string,
        successMessage?: string,
    ) => void
    getThumbnailSvg: () => Promise<string | null>
    copyDiagramToClipboard: () => Promise<boolean>
    isDrawioReady: boolean
    onDrawioLoad: () => void
    resetDrawioReady: () => void
    showSaveDialog: boolean
    setShowSaveDialog: (show: boolean) => void
    saveDiagramToStorage: () => void
}

const DiagramContext = createContext<DiagramContextType | undefined>(undefined)

export function DiagramProvider({ children }: { children: React.ReactNode }) {
    const [chartXML, setChartXML] = useState<string>("")
    const [latestSvg, setLatestSvg] = useState<string>("")
    const [exportCounter, setExportCounter] = useState<number>(0)
    const [diagramHistory, setDiagramHistory] = useState<
        { svg: string; xml: string }[]
    >([])
    const [isDrawioReady, setIsDrawioReady] = useState(false)
    const [showSaveDialog, setShowSaveDialog] = useState(false)
    const [canSaveDiagram, setCanSaveDiagram] = useState(false)
    const hasCalledOnLoadRef = useRef(false)
    const drawioRef = useRef<DrawIoEmbedRef | null>(null)
    const resolverRef = useRef<((value: string) => void) | null>(null)
    // Track if we're expecting an export for history (user-initiated)
    const expectHistoryExportRef = useRef<boolean>(false)
    // Track if diagram has been restored after DrawIO remount (e.g., theme change)
    const hasDiagramRestoredRef = useRef<boolean>(false)
    // Track latest chartXML for restoration after remount
    const chartXMLRef = useRef<string>("")

    const onDrawioLoad = () => {
        // Only set ready state once to prevent infinite loops
        if (hasCalledOnLoadRef.current) return
        hasCalledOnLoadRef.current = true
        setIsDrawioReady(true)
    }

    const resetDrawioReady = () => {
        hasCalledOnLoadRef.current = false
        setIsDrawioReady(false)
    }

    // Keep chartXMLRef in sync with state for restoration after remount
    useEffect(() => {
        chartXMLRef.current = chartXML
    }, [chartXML])

    // Restore diagram when DrawIO becomes ready after remount (e.g., theme/UI change)
    useEffect(() => {
        // Reset restore flag when DrawIO is not ready (preparing for next restore cycle)
        if (!isDrawioReady) {
            hasDiagramRestoredRef.current = false
            return
        }
        // Only restore once per ready cycle
        if (hasDiagramRestoredRef.current) return
        hasDiagramRestoredRef.current = true

        // In embed mode, don't restore from localStorage - wait for parent to send diagram
        if (isEmbedMode()) {
            setCanSaveDiagram(true)
            return
        }

        try {
            const savedDiagramXml = localStorage.getItem(
                STORAGE_DIAGRAM_XML_KEY,
            )
            if (savedDiagramXml) {
                // Skip validation for trusted saved diagrams
                loadDiagram(savedDiagramXml, true)
            }
        } catch (error) {
            console.error("Failed to restore diagram from localStorage:", error)
        }

        setCanSaveDiagram(true)
    }, [isDrawioReady])

    // Save diagram XML to localStorage whenever it changes (debounced)
    // In embed mode, skip localStorage saving - parent handles persistence
    useEffect(() => {
        if (!canSaveDiagram) return
        if (!chartXML || chartXML.length <= 300) return
        if (isEmbedMode()) return // Skip localStorage in embed mode

        const timeoutId = setTimeout(() => {
            localStorage.setItem(STORAGE_DIAGRAM_XML_KEY, chartXML)
        }, 1000)

        return () => clearTimeout(timeoutId)
    }, [chartXML, canSaveDiagram])

    // Track if we're expecting an export for file save (stores raw export data)
    const saveResolverRef = useRef<{
        resolver: ((data: string) => void) | null
        format: ExportFormat | null
    }>({ resolver: null, format: null })

    // Track if we're expecting an export for clipboard copy
    const copyResolverRef = useRef<((data: string) => void) | null>(null)

    const handleExport = () => {
        if (drawioRef.current) {
            // Mark that this export should be saved to history
            expectHistoryExportRef.current = true
            console.log("[NextAI context] handleExport called (with history)")
            drawioRef.current.exportDiagram({
                format: "xmlsvg",
            })
        } else {
            console.error(
                "[NextAI context] handleExport: drawioRef.current is null",
            )
        }
    }

    const handleExportWithoutHistory = () => {
        if (drawioRef.current) {
            // Export without saving to history (for edit_diagram fetching current state)
            console.log("[NextAI context] handleExportWithoutHistory called")
            drawioRef.current.exportDiagram({
                format: "xmlsvg",
            })
        } else {
            console.error(
                "[NextAI context] handleExportWithoutHistory: drawioRef.current is null",
            )
        }
    }

    // Get current diagram as SVG for thumbnail (used by session storage)
    const getThumbnailSvg = async (): Promise<string | null> => {
        if (!drawioRef.current) return null
        // Don't export if diagram is empty
        if (!isRealDiagram(chartXML)) return null

        try {
            const svgData = await Promise.race([
                new Promise<string>((resolve) => {
                    resolverRef.current = resolve
                    drawioRef.current?.exportDiagram({ format: "xmlsvg" })
                }),
                new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error("Export timeout")), 3000),
                ),
            ])

            // Update latestSvg so it's available for future saves
            if (svgData?.includes("<svg")) {
                setLatestSvg(svgData)
                return svgData
            }
            return null
        } catch {
            // Timeout is expected occasionally - don't log as error
            return null
        }
    }

    const loadDiagram = (
        chart: string,
        skipValidation?: boolean,
        saveToHistory?: boolean,
    ): string | null => {
        let xmlToLoad = chart

        // Validate XML structure before loading (unless skipped for internal use)
        if (!skipValidation) {
            const validation = validateAndFixXml(chart)
            if (!validation.valid) {
                console.warn(
                    "[loadDiagram] Validation error:",
                    validation.error,
                )
                return validation.error
            }
            // Use fixed XML if auto-fix was applied
            if (validation.fixed) {
                console.log(
                    "[loadDiagram] Auto-fixed XML issues:",
                    validation.fixes,
                )
                xmlToLoad = validation.fixed
            }
        }

        // Keep chartXML in sync even when diagrams are injected (e.g., display_diagram tool)
        setChartXML(xmlToLoad)

        if (drawioRef.current) {
            drawioRef.current.load({
                xml: xmlToLoad,
            })

            // If saveToHistory is requested, trigger export after a short delay
            // to allow draw.io to finish rendering the loaded diagram
            if (saveToHistory) {
                setTimeout(() => {
                    expectHistoryExportRef.current = true
                    drawioRef.current?.exportDiagram({ format: "xmlsvg" })
                }, 500) // 500ms should be enough for draw.io to render
            }
        }

        return null
    }

    const handleDiagramExport = (data: any) => {
        console.log(
            "[NextAI context] handleDiagramExport called, data.data length:",
            data?.data?.length,
        )

        // Handle save to file if requested (process raw data before extraction)
        if (saveResolverRef.current.resolver) {
            const format = saveResolverRef.current.format
            saveResolverRef.current.resolver(data.data)
            saveResolverRef.current = { resolver: null, format: null }
            // For non-xmlsvg formats, skip XML extraction as it will fail
            // Only drawio (which uses xmlsvg internally) has the content attribute
            if (format === "png" || format === "svg") {
                return
            }
        }

        // Handle copy to clipboard if requested
        if (copyResolverRef.current) {
            copyResolverRef.current(data.data)
            copyResolverRef.current = null
            return
        }

        const extractedXML = extractDiagramXML(data.data)
        console.log(
            "[NextAI context] Extracted XML length:",
            extractedXML?.length,
        )
        setChartXML(extractedXML)
        setLatestSvg(data.data)
        // Increment counter to ensure useEffect triggers even if SVG content is same
        setExportCounter((c) => c + 1)
        console.log("[NextAI context] Updated chartXML and latestSvg")

        // Only add to history if this was a user-initiated export
        // Limit to 20 entries to prevent memory leaks during long sessions
        const MAX_HISTORY_SIZE = 20
        if (expectHistoryExportRef.current) {
            setDiagramHistory((prev) => {
                const newHistory = [
                    ...prev,
                    {
                        svg: data.data,
                        xml: extractedXML,
                    },
                ]
                // Keep only the last MAX_HISTORY_SIZE entries (circular buffer)
                return newHistory.slice(-MAX_HISTORY_SIZE)
            })
            expectHistoryExportRef.current = false
        }

        if (resolverRef.current) {
            resolverRef.current(extractedXML)
            resolverRef.current = null
        }
    }

    const clearDiagram = () => {
        const emptyDiagram = `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
        // Skip validation for trusted internal template (loadDiagram also sets chartXML)
        loadDiagram(emptyDiagram, true)
        setLatestSvg("")
        setDiagramHistory([])
    }

    const saveDiagramToStorage = () => {
        if (chartXML && chartXML.length > 300) {
            localStorage.setItem(STORAGE_DIAGRAM_XML_KEY, chartXML)
        }
    }

    // Copy diagram to clipboard as high-resolution PNG image
    const copyDiagramToClipboard = async (): Promise<boolean> => {
        if (!drawioRef.current) {
            console.warn("[copyDiagramToClipboard] Draw.io editor not ready")
            return false
        }

        // Don't copy if diagram is empty
        if (!isRealDiagram(chartXML)) {
            console.warn("[copyDiagramToClipboard] No diagram to copy")
            return false
        }

        try {
            // Export diagram as PNG (scale: 2 = 2x for Retina displays)
            const pngData = await Promise.race([
                new Promise<string>((resolve) => {
                    copyResolverRef.current = resolve
                    drawioRef.current?.exportDiagram({
                        format: "png",
                        scale: 2,
                    })
                }),
                new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error("Export timeout")), 5000),
                ),
            ])

            // Convert data URL to blob
            const response = await fetch(pngData)
            const blob = await response.blob()

            // Copy to clipboard using Clipboard API
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob,
                }),
            ])

            return true
        } catch (error) {
            console.error("[copyDiagramToClipboard] Failed to copy:", error)
            return false
        }
    }

    const saveDiagramToFile = (
        filename: string,
        format: ExportFormat,
        sessionId?: string,
        successMessage?: string,
    ) => {
        if (!drawioRef.current) {
            console.warn("Draw.io editor not ready")
            return
        }

        // Map format to draw.io export format
        const drawioFormat = format === "drawio" ? "xmlsvg" : format

        // Set up the resolver before triggering export
        saveResolverRef.current = {
            resolver: (exportData: string) => {
                let fileContent: string | Blob
                let mimeType: string
                let extension: string

                if (format === "drawio") {
                    // Extract XML from SVG for .drawio format
                    const xml = extractDiagramXML(exportData)
                    let xmlContent = xml
                    if (!xml.includes("<mxfile")) {
                        xmlContent = `<mxfile><diagram name="Page-1" id="page-1">${xml}</diagram></mxfile>`
                    }
                    fileContent = xmlContent
                    mimeType = "application/xml"
                    extension = ".drawio"
                } else if (format === "png") {
                    // PNG data comes as base64 data URL
                    fileContent = exportData
                    mimeType = "image/png"
                    extension = ".png"
                } else {
                    // SVG format
                    fileContent = exportData
                    mimeType = "image/svg+xml"
                    extension = ".svg"
                }

                // Log save event to Langfuse (flags the trace)
                logSaveToLangfuse(filename, format, sessionId)

                // Handle download
                let url: string
                if (
                    typeof fileContent === "string" &&
                    fileContent.startsWith("data:")
                ) {
                    // Already a data URL (PNG)
                    url = fileContent
                } else {
                    const blob = new Blob([fileContent], { type: mimeType })
                    url = URL.createObjectURL(blob)
                }

                const a = document.createElement("a")
                a.href = url
                a.download = `${filename}${extension}`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)

                // Show success toast after download is initiated
                if (successMessage) {
                    toast.success(successMessage, {
                        position: "bottom-left",
                        duration: 2500,
                    })
                }

                // Delay URL revocation to ensure download completes
                if (!url.startsWith("data:")) {
                    setTimeout(() => URL.revokeObjectURL(url), 100)
                }
            },
            format,
        }

        // Export diagram - callback will be handled in handleDiagramExport
        drawioRef.current.exportDiagram({ format: drawioFormat })
    }

    // Log save event to Langfuse (just flags the trace, doesn't send content)
    const logSaveToLangfuse = async (
        filename: string,
        format: string,
        sessionId?: string,
    ) => {
        try {
            await fetch(getApiEndpoint("/api/log-save"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename, format, sessionId }),
            })
        } catch (error) {
            console.warn("Failed to log save to Langfuse:", error)
        }
    }

    return (
        <DiagramContext.Provider
            value={{
                chartXML,
                latestSvg,
                exportCounter,
                diagramHistory,
                setDiagramHistory,
                loadDiagram,
                handleExport,
                handleExportWithoutHistory,
                resolverRef,
                drawioRef,
                handleDiagramExport,
                clearDiagram,
                saveDiagramToFile,
                getThumbnailSvg,
                copyDiagramToClipboard,
                isDrawioReady,
                onDrawioLoad,
                resetDrawioReady,
                showSaveDialog,
                setShowSaveDialog,
                saveDiagramToStorage,
            }}
        >
            {children}
        </DiagramContext.Provider>
    )
}

export function useDiagram() {
    const context = useContext(DiagramContext)
    if (context === undefined) {
        throw new Error("useDiagram must be used within a DiagramProvider")
    }
    return context
}
