"use client"

import { Plus, Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    createFolder,
    deleteFolder,
    deleteSession,
    type FolderMetadata,
    getAllFolders,
    getAllSessionMetadata,
    moveSessionToFolder,
    renameFolder,
    renameSession,
    type SessionMetadata,
} from "@/lib/session-storage"
import { FolderSidebar } from "./folder-sidebar"
import { SessionGridCard } from "./session-grid-card"

// Date grouping types
type DateGroup = "today" | "yesterday" | "lastWeek" | "older"

function getDateGroup(timestamp: string | number): DateGroup {
    const date = new Date(timestamp)
    const now = new Date()
    const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
    )
    const startOfYesterday = new Date(startOfToday)
    startOfYesterday.setDate(startOfYesterday.getDate() - 1)
    const startOfLastWeek = new Date(startOfToday)
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

    if (date >= startOfToday) return "today"
    if (date >= startOfYesterday) return "yesterday"
    if (date >= startOfLastWeek) return "lastWeek"
    return "older"
}

function formatSessionDate(
    timestamp: string | number,
    group: DateGroup,
    dict?: { justNow?: string },
): string {
    const date = new Date(timestamp)
    const now = Date.now()
    const diffMs = now - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return dict?.justNow || "Just now"
    if (diffMins < 60) return `${diffMins}m`

    if (group === "today" || group === "yesterday") {
        return date.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
        })
    }
    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    })
}

function getGroupLabel(
    group: DateGroup,
    dict?: {
        today?: string
        yesterday?: string
        lastWeek?: string
        older?: string
    },
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

interface HistoryPageProps {
    lang: string
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
            newChat?: string
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
        }
    }
}

export function HistoryPage({ lang, dict }: HistoryPageProps) {
    const router = useRouter()
    const [sessions, setSessions] = useState<SessionMetadata[]>([])
    const [folders, setFolders] = useState<FolderMetadata[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
        null,
    )
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
    const [renameDialogOpen, setRenameDialogOpen] = useState(false)
    const [sessionToRename, setSessionToRename] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState("")

    // Load sessions and folders
    useEffect(() => {
        async function loadData() {
            setIsLoading(true)
            try {
                const [sessionsData, foldersData] = await Promise.all([
                    getAllSessionMetadata(),
                    getAllFolders(),
                ])
                setSessions(sessionsData)
                setFolders(foldersData)
            } catch (error) {
                console.error("Failed to load data:", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadData()
    }, [])

    const hasFolders = folders.length > 0

    // Filter and group sessions
    const groupedSessions = useMemo(() => {
        let filtered = sessions.filter((session) =>
            session.title.toLowerCase().includes(searchQuery.toLowerCase()),
        )

        // Apply folder filter
        if (selectedFolderId === "uncategorized") {
            filtered = filtered.filter((s) => !s.folderId)
        } else if (selectedFolderId !== null) {
            filtered = filtered.filter((s) => s.folderId === selectedFolderId)
        }

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

    // Compute folder session counts dynamically from sessions state
    const foldersWithCounts = useMemo(() => {
        return folders.map((folder) => ({
            ...folder,
            sessionCount: sessions.filter((s) => s.folderId === folder.id)
                .length,
        }))
    }, [folders, sessions])

    // Handlers
    const handleNewSession = () => {
        router.push(`/${lang}/session/new`)
    }

    const handleDeleteSession = async () => {
        if (!sessionToDelete) return
        const success = await deleteSession(sessionToDelete)
        if (success) {
            setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete))
        }
        setDeleteDialogOpen(false)
        setSessionToDelete(null)
    }

    const handleRenameSession = async () => {
        if (!sessionToRename || !renameValue.trim()) return
        const success = await renameSession(sessionToRename, renameValue.trim())
        if (success) {
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionToRename
                        ? { ...s, title: renameValue.trim() }
                        : s,
                ),
            )
        }
        setRenameDialogOpen(false)
        setSessionToRename(null)
        setRenameValue("")
    }

    const handleCreateFolder = async (name: string) => {
        const folder = await createFolder(name)
        if (folder) {
            setFolders((prev) =>
                [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)),
            )
        }
    }

    const handleRenameFolder = async (id: string, newName: string) => {
        const updated = await renameFolder(id, newName)
        if (updated) {
            setFolders((prev) =>
                prev
                    .map((f) =>
                        f.id === id ? { ...f, name: updated.name } : f,
                    )
                    .sort((a, b) => a.name.localeCompare(b.name)),
            )
        }
    }

    const handleDeleteFolder = async (id: string) => {
        const success = await deleteFolder(id)
        if (success) {
            setFolders((prev) => prev.filter((f) => f.id !== id))
            if (selectedFolderId === id) {
                setSelectedFolderId(null)
            }
        }
    }

    const openRenameDialog = (id: string) => {
        const session = sessions.find((s) => s.id === id)
        if (session) {
            setSessionToRename(id)
            setRenameValue(session.title)
            setRenameDialogOpen(true)
        }
    }

    const handleMoveToFolder = async (
        sessionId: string,
        folderId: string | null,
    ) => {
        const success = await moveSessionToFolder(sessionId, folderId)
        if (success) {
            setSessions((prev) =>
                prev.map((s) => (s.id === sessionId ? { ...s, folderId } : s)),
            )
        }
    }

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <div className="animate-pulse text-muted-foreground">
                    Loading...
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen flex bg-background">
            {/* Folder Sidebar */}
            {(hasFolders || sessions.length > 5) && (
                <div className="w-56 shrink-0 hidden lg:block">
                    <FolderSidebar
                        folders={foldersWithCounts}
                        selectedFolderId={selectedFolderId}
                        onSelectFolder={setSelectedFolderId}
                        onCreateFolder={handleCreateFolder}
                        onRenameFolder={handleRenameFolder}
                        onDeleteFolder={handleDeleteFolder}
                        dict={dict}
                    />
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="shrink-0 px-6 py-4 border-b border-border/50">
                    <div className="flex items-center justify-between gap-4">
                        <h1 className="text-xl font-semibold text-foreground">
                            {dict.sessionHistory?.recentChats || "Recent Chats"}
                        </h1>

                        <div className="flex items-center gap-3 flex-1 max-w-md">
                            {/* Search */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    placeholder={
                                        dict.sessionHistory
                                            ?.searchPlaceholder ||
                                        "Search chats..."
                                    }
                                    className="pl-9 pr-8"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-accent"
                                    >
                                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                                    </button>
                                )}
                            </div>

                            {/* New Chat Button */}
                            <Button
                                onClick={handleNewSession}
                                className="shrink-0"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {dict.sessionHistory?.newChat || "New Chat"}
                            </Button>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-6">
                    {sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="text-muted-foreground mb-4">
                                No chats yet
                            </div>
                            <Button onClick={handleNewSession}>
                                <Plus className="w-4 h-4 mr-2" />
                                Start New Chat
                            </Button>
                        </div>
                    ) : !hasResults ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Search className="w-12 h-12 text-muted-foreground/20 mb-3" />
                            <p className="text-lg font-medium text-foreground">
                                {dict.sessionHistory?.noResults ||
                                    "No chats found"}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {groupOrder.map((group) => {
                                const sessionsInGroup = groupedSessions[group]
                                if (sessionsInGroup.length === 0) return null

                                return (
                                    <div key={group}>
                                        {/* Group Header */}
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="text-sm font-medium text-muted-foreground">
                                                {getGroupLabel(
                                                    group,
                                                    dict.sessionHistory,
                                                )}
                                            </span>
                                            <div className="flex-1 h-px bg-border/40" />
                                        </div>

                                        {/* Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                            {sessionsInGroup.map((session) => (
                                                <SessionGridCard
                                                    key={session.id}
                                                    session={session}
                                                    lang={lang}
                                                    folders={folders}
                                                    dict={dict}
                                                    dateLabel={formatSessionDate(
                                                        session.updatedAt,
                                                        group,
                                                        dict.sessionHistory,
                                                    )}
                                                    onDelete={(id) => {
                                                        setSessionToDelete(id)
                                                        setDeleteDialogOpen(
                                                            true,
                                                        )
                                                    }}
                                                    onRename={openRenameDialog}
                                                    onMoveToFolder={
                                                        handleMoveToFolder
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </main>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {dict.sessionHistory?.deleteTitle || "Delete Chat?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {dict.sessionHistory?.deleteDescription ||
                                "This action cannot be undone."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {dict.common.cancel}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteSession}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {dict.common.delete}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Rename Dialog */}
            <AlertDialog
                open={renameDialogOpen}
                onOpenChange={setRenameDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {dict.sessionHistory?.renameTitle || "Rename Chat"}
                        </AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            placeholder={
                                dict.sessionHistory?.renamePlaceholder ||
                                "Enter new name..."
                            }
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameSession()
                            }}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {dict.common.cancel}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleRenameSession}>
                            {dict.common.save}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
