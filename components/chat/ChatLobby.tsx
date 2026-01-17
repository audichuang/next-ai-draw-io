"use client"

import { ChevronDown, ChevronUp, Search, X } from "lucide-react"
import { useMemo, useState } from "react"
import ExamplePanel from "@/components/chat-example-panel"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { FolderMetadata } from "@/lib/session-storage"
import { FolderSidebar } from "./folder-sidebar"
import { SessionListItem, type SessionMetadata } from "./session-list-item"

interface ChatLobbyProps {
    sessions: SessionMetadata[]
    folders?: FolderMetadata[]
    onSelectSession: (id: string) => void
    onDeleteSession?: (id: string) => void
    onRenameSession?: (id: string, newTitle: string) => void
    onMoveToFolder?: (sessionId: string, folderId: string | null) => void
    onCreateFolder?: (name: string) => void
    onRenameFolder?: (id: string, newName: string) => void
    onDeleteFolder?: (id: string) => void
    setInput: (input: string) => void
    setFiles: (files: File[]) => void
    dict: {
        sessionHistory?: {
            recentChats?: string
            searchPlaceholder?: string
            noResults?: string
            justNow?: string
            deleteTitle?: string
            deleteDescription?: string
            today?: string
            yesterday?: string
            lastWeek?: string
            older?: string
            messages?: string
            renameTitle?: string
            renamePlaceholder?: string
        }
        examples?: {
            quickExamples?: string
        }
        common: {
            delete: string
            cancel: string
            edit: string
            save: string
            rename: string
        }
        folders?: {
            all?: string
            uncategorized?: string
            newFolder?: string
            folderNamePlaceholder?: string
            moveToFolder?: string
            noFolder?: string
        }
    }
}

// Group sessions by date category
type DateGroup = "today" | "yesterday" | "lastWeek" | "older"

function getDateGroup(timestamp: string | number): DateGroup {
    const date = new Date(timestamp)
    const now = new Date()
    const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
    )
    const startOfYesterday = new Date(
        startOfToday.getTime() - 24 * 60 * 60 * 1000,
    )
    const startOfLastWeek = new Date(
        startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000,
    )

    if (date >= startOfToday) return "today"
    if (date >= startOfYesterday) return "yesterday"
    if (date >= startOfLastWeek) return "lastWeek"
    return "older"
}

// Format session date based on context
function formatSessionDate(
    timestamp: string | number,
    group: DateGroup,
    dict?: { justNow?: string },
): string {
    const date = new Date(timestamp)
    const diffMins = Math.floor((Date.now() - date.getTime()) / (1000 * 60))

    // For today: show relative time or specific time
    if (group === "today") {
        if (diffMins < 1) return dict?.justNow || "Just now"
        if (diffMins < 60) return `${diffMins}m ago`
        return date.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
        })
    }

    // For yesterday: show day name + time
    if (group === "yesterday") {
        return date.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
        })
    }

    // For last week: show weekday + time
    if (group === "lastWeek") {
        return date.toLocaleDateString(undefined, {
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
        })
    }

    // For older: show date
    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    })
}

// Get group label
function getGroupLabel(
    group: DateGroup,
    dict?: ChatLobbyProps["dict"]["sessionHistory"],
): string {
    switch (group) {
        case "today":
            return dict?.today || "Today"
        case "yesterday":
            return dict?.yesterday || "Yesterday"
        case "lastWeek":
            return dict?.lastWeek || "Last 7 Days"
        case "older":
            return dict?.older || "Older"
    }
}

export function ChatLobby({
    sessions,
    folders = [],
    onSelectSession,
    onDeleteSession,
    onRenameSession,
    onMoveToFolder,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    setInput,
    setFiles,
    dict,
}: ChatLobbyProps) {
    // Track whether examples section is expanded (collapsed by default when there's history)
    const [examplesExpanded, setExamplesExpanded] = useState(false)
    // Delete confirmation dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
    // Search filter for history
    const [searchQuery, setSearchQuery] = useState("")
    // Selected folder filter: null = all, "uncategorized" = no folder, string = folder ID
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
        null,
    )

    const hasHistory = sessions.length > 0
    const hasFolders = folders.length > 0

    // Filter and group sessions (by search AND folder)
    const groupedSessions = useMemo(() => {
        let filtered = sessions.filter((session) =>
            session.title.toLowerCase().includes(searchQuery.toLowerCase()),
        )

        // Apply folder filter
        if (selectedFolderId === "uncategorized") {
            // Show sessions without a folder (folderId is null/undefined)
            filtered = filtered.filter((s) => !(s as any).folderId)
        } else if (selectedFolderId !== null) {
            // Show sessions in the specific folder
            filtered = filtered.filter(
                (s) => (s as any).folderId === selectedFolderId,
            )
        }
        // if selectedFolderId === null, show all sessions

        const groups: Record<DateGroup, SessionMetadata[]> = {
            today: [],
            yesterday: [],
            lastWeek: [],
            older: [],
        }

        for (const session of filtered) {
            const group = getDateGroup(session.updatedAt)
            groups[group].push(session)
        }

        return groups
    }, [sessions, searchQuery, selectedFolderId])

    const groupOrder: DateGroup[] = ["today", "yesterday", "lastWeek", "older"]
    const hasResults = groupOrder.some((g) => groupedSessions[g].length > 0)

    if (!hasHistory) {
        // Show full examples when no history
        return <ExamplePanel setInput={setInput} setFiles={setFiles} />
    }

    return (
        <div className="flex h-full animate-fade-in">
            {/* Folder Sidebar - only show when folders exist or there are enough sessions */}
            {(hasFolders || sessions.length > 5) && (
                <div className="w-52 shrink-0 hidden lg:block border-r border-border/30">
                    <FolderSidebar
                        folders={folders}
                        selectedFolderId={selectedFolderId}
                        onSelectFolder={setSelectedFolderId}
                        onCreateFolder={(name) => onCreateFolder?.(name)}
                        onRenameFolder={(id, newName) =>
                            onRenameFolder?.(id, newName)
                        }
                        onDeleteFolder={(id) => onDeleteFolder?.(id)}
                        dict={dict}
                    />
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 py-6 px-4 overflow-y-auto">
                {/* Header / Search Section */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="text-xl font-semibold tracking-tight text-foreground hidden md:block">
                        {dict.sessionHistory?.recentChats || "Recent Chats"}
                    </h1>

                    {/* Search Bar - Wider on desktop */}
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder={
                                dict.sessionHistory?.searchPlaceholder ||
                                "Search chats..."
                            }
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all shadow-sm"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
                            >
                                <X className="w-3 h-3 text-muted-foreground" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Grouped Sessions Grid Layout */}
                <div className="space-y-8">
                    {groupOrder.map((group) => {
                        const sessionsInGroup = groupedSessions[group]
                        if (sessionsInGroup.length === 0) return null

                        return (
                            <div key={group}>
                                {/* Group header */}
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-sm font-semibold text-muted-foreground/80 bg-background px-1 z-10">
                                        {getGroupLabel(
                                            group,
                                            dict.sessionHistory,
                                        )}
                                    </span>
                                    <div className="flex-1 h-px bg-border/40" />
                                </div>

                                {/* List Layout */}
                                <div className="space-y-1">
                                    {sessionsInGroup.map((session) => (
                                        <SessionListItem
                                            key={session.id}
                                            session={session}
                                            folders={folders}
                                            dict={dict}
                                            dateLabel={formatSessionDate(
                                                session.updatedAt,
                                                group,
                                                dict.sessionHistory,
                                            )}
                                            onSelect={onSelectSession}
                                            onDelete={(id) => {
                                                setSessionToDelete(id)
                                                setDeleteDialogOpen(true)
                                            }}
                                            onRename={(id, newTitle) => {
                                                if (onRenameSession) {
                                                    onRenameSession(
                                                        id,
                                                        newTitle,
                                                    )
                                                }
                                            }}
                                            onMoveToFolder={onMoveToFolder}
                                        />
                                    ))}
                                </div>
                            </div>
                        )
                    })}

                    {/* No results message */}
                    {!hasResults && searchQuery && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Search className="w-12 h-12 text-muted-foreground/20 mb-3" />
                            <p className="text-lg font-medium text-foreground">
                                {dict.sessionHistory?.noResults ||
                                    "No chats found"}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Try adjusting your search terms
                            </p>
                        </div>
                    )}
                </div>

                {/* Collapsible Examples Section - At bottom as footer */}
                <div className="border-t border-border/50 pt-6 mt-8">
                    <button
                        type="button"
                        onClick={() => setExamplesExpanded(!examplesExpanded)}
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {examplesExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                        ) : (
                            <ChevronDown className="w-4 h-4" />
                        )}
                        <span>
                            {dict.examples?.quickExamples || "Quick Examples"}
                        </span>
                    </button>
                    {examplesExpanded && (
                        <div className="mt-4">
                            <ExamplePanel
                                setInput={setInput}
                                setFiles={setFiles}
                                minimal
                            />
                        </div>
                    )}
                </div>

                {/* Delete Confirmation Dialog */}
                <AlertDialog
                    open={deleteDialogOpen}
                    onOpenChange={setDeleteDialogOpen}
                >
                    <AlertDialogContent className="max-w-sm">
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {dict.sessionHistory?.deleteTitle ||
                                    "Delete this chat?"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {dict.sessionHistory?.deleteDescription ||
                                    "This will permanently delete this chat session and its diagram. This action cannot be undone."}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>
                                {dict.common.cancel}
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    if (sessionToDelete && onDeleteSession) {
                                        onDeleteSession(sessionToDelete)
                                    }
                                    setDeleteDialogOpen(false)
                                    setSessionToDelete(null)
                                }}
                                className="border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400"
                            >
                                {dict.common.delete}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    )
}
