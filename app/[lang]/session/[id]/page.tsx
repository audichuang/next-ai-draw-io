"use client"
import { usePathname, useRouter } from "next/navigation"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { DrawIoEmbed } from "react-drawio"
import type { ImperativePanelHandle } from "react-resizable-panels"
import ChatPanel from "@/components/chat-panel"
import { STORAGE_CLOSE_PROTECTION_KEY } from "@/components/settings-dialog"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useDiagram } from "@/contexts/diagram-context"
import { useEmbedMode } from "@/hooks/use-embed-mode"
import { i18n, type Locale } from "@/lib/i18n/config"

const drawioBaseUrl =
    process.env.NEXT_PUBLIC_DRAWIO_BASE_URL || "https://embed.diagrams.net"

interface EditorPageProps {
    params: Promise<{ lang: string; id: string }>
}

export default function EditorPage({ params }: EditorPageProps) {
    const resolvedParams = React.use(params)
    const sessionId = resolvedParams.id

    const { drawioRef, handleDiagramExport, onDrawioLoad, resetDrawioReady } =
        useDiagram()

    // Reset DrawIO ready state on mount and unmount to prevent stale state in Context
    // This fixes the issue where navigating between pages would leave isDrawioReady=true
    // causing pending load queue to be ignored when the new iframe was actually loading
    useEffect(() => {
        resetDrawioReady()
        return () => {
            resetDrawioReady()
        }
    }, [resetDrawioReady])

    // State for chat history from parent (in embed mode)
    const [parentChatHistory, setParentChatHistory] = useState<string>("")
    // Ref to get current chat history for export
    const getChatHistoryRef = useRef<(() => string) | null>(null)

    // Callback to get chat history for export
    const getChatHistory = useCallback(() => {
        return getChatHistoryRef.current?.() || ""
    }, [])

    // Callback when parent sends chat history
    const handleChatHistoryLoaded = useCallback((chatHistory: string) => {
        console.log(
            "[EditorPage] Chat history loaded from parent, length:",
            chatHistory?.length,
        )
        setParentChatHistory(chatHistory)
    }, [])

    // Embed mode hook for parent window communication
    const { isEmbedMode, triggerSaveToParent } = useEmbedMode({
        onChatHistoryLoaded: handleChatHistoryLoaded,
        getChatHistory,
    })

    const router = useRouter()
    const pathname = usePathname()
    // Extract current language from pathname
    const currentLang = (pathname.split("/")[1] || i18n.defaultLocale) as Locale

    const [isMobile, setIsMobile] = useState(false)
    const [isChatVisible, setIsChatVisible] = useState(true)
    const [drawioUi, setDrawioUi] = useState<"min" | "sketch">("min")
    const [darkMode, setDarkMode] = useState(false)
    const [isLoaded, setIsLoaded] = useState(false)
    const [isDrawioReady, setIsDrawioReady] = useState(false)
    const [closeProtection, setCloseProtection] = useState(false)
    const [loadError, setLoadError] = useState(false)
    const [retryCount, setRetryCount] = useState(0)

    const chatPanelRef = useRef<ImperativePanelHandle>(null)
    const isMobileRef = useRef(false)

    // Load preferences from localStorage after mount
    useEffect(() => {
        const savedUi = localStorage.getItem("drawio-theme")
        if (savedUi === "min" || savedUi === "sketch") {
            setDrawioUi(savedUi)
        }

        const savedDarkMode = localStorage.getItem("next-ai-draw-io-dark-mode")
        if (savedDarkMode !== null) {
            const isDark = savedDarkMode === "true"
            setDarkMode(isDark)
            document.documentElement.classList.toggle("dark", isDark)
        } else {
            const prefersDark = window.matchMedia(
                "(prefers-color-scheme: dark)",
            ).matches
            setDarkMode(prefersDark)
            document.documentElement.classList.toggle("dark", prefersDark)
        }

        const savedCloseProtection = localStorage.getItem(
            STORAGE_CLOSE_PROTECTION_KEY,
        )
        if (savedCloseProtection === "true") {
            setCloseProtection(true)
        }

        setIsLoaded(true)
    }, [])

    const handleDrawioLoad = useCallback(() => {
        setIsDrawioReady(true)
        setLoadError(false)
        onDrawioLoad()
    }, [onDrawioLoad])

    // Handle retry when loading fails
    const handleRetry = useCallback(() => {
        setLoadError(false)
        setIsDrawioReady(false)
        resetDrawioReady()
        setRetryCount((prev) => prev + 1)
    }, [resetDrawioReady])

    // Loading timeout effect - 30 seconds
    const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    useEffect(() => {
        // Clear previous timeout
        if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current)
            loadTimeoutRef.current = null
        }

        // Only set timeout if we're loading (isLoaded but not isDrawioReady)
        if (isLoaded && !isDrawioReady && !loadError) {
            loadTimeoutRef.current = setTimeout(() => {
                console.error(
                    "[EditorPage] DrawIO loading timeout after 30 seconds",
                )
                setLoadError(true)
            }, 30000)
        }

        return () => {
            if (loadTimeoutRef.current) {
                clearTimeout(loadTimeoutRef.current)
                loadTimeoutRef.current = null
            }
        }
    }, [isLoaded, isDrawioReady, loadError, retryCount])

    const handleDarkModeChange = () => {
        const newValue = !darkMode
        setDarkMode(newValue)
        localStorage.setItem("next-ai-draw-io-dark-mode", String(newValue))
        document.documentElement.classList.toggle("dark", newValue)
        setIsDrawioReady(false)
        resetDrawioReady()
    }

    const handleDrawioUiChange = () => {
        const newUi = drawioUi === "min" ? "sketch" : "min"
        localStorage.setItem("drawio-theme", newUi)
        setDrawioUi(newUi)
        setIsDrawioReady(false)
        resetDrawioReady()
    }

    // Check mobile - reset draw.io before crossing breakpoint
    // Use debounce to avoid rapid resize events from panel dragging causing jitter
    const isInitialRenderRef = useRef(true)
    const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    useEffect(() => {
        const checkMobile = () => {
            const newIsMobile = window.innerWidth < 768
            if (
                !isInitialRenderRef.current &&
                newIsMobile !== isMobileRef.current
            ) {
                setIsDrawioReady(false)
                resetDrawioReady()
            }
            isMobileRef.current = newIsMobile
            isInitialRenderRef.current = false
            setIsMobile(newIsMobile)
        }

        const debouncedCheckMobile = () => {
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current)
            }
            resizeTimeoutRef.current = setTimeout(checkMobile, 150)
        }

        checkMobile() // Initial check without debounce
        window.addEventListener("resize", debouncedCheckMobile)
        return () => {
            window.removeEventListener("resize", debouncedCheckMobile)
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current)
            }
        }
    }, [resetDrawioReady])

    const toggleChatPanel = () => {
        const panel = chatPanelRef.current
        if (panel) {
            if (panel.isCollapsed()) {
                panel.expand()
                setIsChatVisible(true)
            } else {
                panel.collapse()
                setIsChatVisible(false)
            }
        }
    }

    // Keyboard shortcut for toggling chat panel
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "b") {
                event.preventDefault()
                toggleChatPanel()
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [])

    // Show confirmation dialog when user tries to leave the page
    useEffect(() => {
        if (!closeProtection) return

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            return ""
        }

        window.addEventListener("beforeunload", handleBeforeUnload)
        return () =>
            window.removeEventListener("beforeunload", handleBeforeUnload)
    }, [closeProtection])

    // Navigate back to history
    const handleBackToHistory = useCallback(() => {
        router.push(`/${currentLang}`)
    }, [router, currentLang])

    return (
        <div className="h-screen bg-background relative overflow-hidden">
            <ResizablePanelGroup
                id="main-panel-group"
                direction={isMobile ? "vertical" : "horizontal"}
                className="h-full"
            >
                <ResizablePanel
                    id="drawio-panel"
                    defaultSize={isMobile ? 50 : 67}
                    minSize={20}
                >
                    <div
                        className={`h-full relative ${
                            isMobile ? "p-1" : "p-2"
                        }`}
                    >
                        <div className="h-full rounded-xl overflow-hidden shadow-soft-lg border border-border/30 relative">
                            {isLoaded && !loadError && (
                                <div
                                    className={`h-full w-full ${isDrawioReady ? "" : "invisible absolute inset-0"}`}
                                >
                                    <DrawIoEmbed
                                        key={`${drawioUi}-${darkMode}-${currentLang}-${retryCount}`}
                                        ref={drawioRef}
                                        onExport={handleDiagramExport}
                                        onLoad={handleDrawioLoad}
                                        baseUrl={drawioBaseUrl}
                                        urlParameters={{
                                            ui: drawioUi,
                                            spin: false,
                                            libraries: false,
                                            saveAndExit: false,
                                            noSaveBtn: true,
                                            noExitBtn: true,
                                            dark: darkMode,
                                            lang: currentLang.toLowerCase(),
                                        }}
                                    />
                                </div>
                            )}
                            {(!isLoaded || !isDrawioReady) && !loadError && (
                                <div className="h-full w-full bg-background flex flex-col items-center justify-center gap-3">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    <span className="text-muted-foreground">
                                        Draw.io panel is loading...
                                    </span>
                                </div>
                            )}
                            {loadError && (
                                <div className="h-full w-full bg-background flex flex-col items-center justify-center gap-4">
                                    <span className="text-destructive font-medium">
                                        Failed to load Draw.io editor
                                    </span>
                                    <span className="text-muted-foreground text-sm text-center max-w-md">
                                        The diagram editor took too long to
                                        load. This may be due to a slow network
                                        connection or the service being
                                        temporarily unavailable.
                                    </span>
                                    <button
                                        onClick={handleRetry}
                                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Chat Panel */}
                <ResizablePanel
                    key={isMobile ? "mobile" : "desktop"}
                    id="chat-panel"
                    ref={chatPanelRef}
                    defaultSize={isMobile ? 50 : 33}
                    minSize={isMobile ? 20 : 15}
                    maxSize={isMobile ? 80 : 50}
                    collapsible={!isMobile}
                    collapsedSize={isMobile ? 0 : 3}
                    onCollapse={() => setIsChatVisible(false)}
                    onExpand={() => setIsChatVisible(true)}
                >
                    <div className={`h-full ${isMobile ? "p-1" : "py-2 pr-2"}`}>
                        <Suspense
                            fallback={
                                <div className="h-full bg-card rounded-xl border border-border/30 flex items-center justify-center text-muted-foreground">
                                    Loading chat...
                                </div>
                            }
                        >
                            <ChatPanel
                                isVisible={isChatVisible}
                                onToggleVisibility={toggleChatPanel}
                                drawioUi={drawioUi}
                                onToggleDrawioUi={handleDrawioUiChange}
                                darkMode={darkMode}
                                onToggleDarkMode={handleDarkModeChange}
                                isMobile={isMobile}
                                onCloseProtectionChange={setCloseProtection}
                                isEmbedMode={isEmbedMode}
                                onSaveToParent={triggerSaveToParent}
                                initialChatHistory={parentChatHistory}
                                onChatHistoryExport={(fn) => {
                                    getChatHistoryRef.current = fn
                                }}
                                initialSessionId={sessionId}
                                onBackToHistory={handleBackToHistory}
                            />
                        </Suspense>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    )
}

import React from "react"
