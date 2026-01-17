"use client"

import {
    FileText,
    FolderInput,
    MessageSquare,
    MoreVertical,
    Pencil,
    Trash2,
} from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import type { FolderMetadata } from "@/lib/session-storage"

export interface SessionMetadata {
    id: string
    title: string
    createdAt: string
    updatedAt: string
    messageCount: number
    hasDiagram: boolean
    thumbnailDataUrl?: string
}

interface SessionCardProps {
    session: SessionMetadata
    folders?: FolderMetadata[]
    dict: {
        common: {
            edit: string
            delete: string
            save: string
            cancel: string
            rename: string
        }
        sessionHistory?: {
            messages?: string
            renameTitle?: string
            renamePlaceholder?: string
        }
        folders?: {
            moveToFolder?: string
            noFolder?: string
        }
    }
    dateLabel: string
    onSelect: (id: string) => void
    onDelete: (id: string) => void
    onRename: (id: string, newTitle: string) => void
    onMoveToFolder?: (sessionId: string, folderId: string | null) => void
}

export function SessionCard({
    session,
    folders = [],
    dict,
    dateLabel,
    onSelect,
    onDelete,
    onRename,
    onMoveToFolder,
}: SessionCardProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(session.title)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isEditing) {
            setEditValue(session.title)
            // Small timeout to ensure DOM is ready
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [isEditing, session.title])

    const handleSave = () => {
        const newTitle = editValue.trim()
        if (newTitle && newTitle !== session.title) {
            onRename(session.id, newTitle)
        }
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSave()
        if (e.key === "Escape") {
            setEditValue(session.title)
            setIsEditing(false)
        }
    }

    // Stop propagation for action buttons to prevent opening the session
    const stopProp = (e: React.MouseEvent) => e.stopPropagation()

    return (
        <div
            className="group relative flex flex-col rounded-xl border border-border/60 bg-card hover:bg-accent/50 hover:border-primary/30 transition-all duration-200 cursor-pointer overflow-hidden shadow-sm hover:shadow-md"
            onClick={() => onSelect(session.id)}
        >
            {/* Thumbnail Area - Aspect Ratio 16:10 for better visibility */}
            <div className="relative aspect-[16/10] w-full bg-muted/30 border-b border-border/40 overflow-hidden">
                {session.thumbnailDataUrl ? (
                    <Image
                        src={session.thumbnailDataUrl}
                        alt={session.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/20">
                        {session.hasDiagram ? (
                            <FileText className="w-12 h-12 text-blue-500/40" />
                        ) : (
                            <MessageSquare className="w-12 h-12 text-primary/30" />
                        )}
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="p-3">
                {isEditing ? (
                    <div
                        className="flex items-center gap-2 mb-1"
                        onClick={stopProp}
                    >
                        <Input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSave}
                            placeholder={
                                dict.sessionHistory?.renamePlaceholder ||
                                "Enter title"
                            }
                            className="h-7 text-sm px-2 py-1"
                        />
                    </div>
                ) : (
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <h3
                            className="font-medium text-sm text-foreground truncate leading-tight pt-0.5"
                            title={session.title}
                        >
                            {session.title}
                        </h3>

                        {/* Options Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={stopProp}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1"
                                >
                                    <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        stopProp(e)
                                        setIsEditing(true)
                                    }}
                                >
                                    <Pencil className="w-3.5 h-3.5 mr-2" />
                                    {dict.common.rename || "Rename"}
                                </DropdownMenuItem>
                                {onMoveToFolder && (
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            stopProp(e)
                                            // For simplicity, show a native prompt for folder selection
                                            // In a more polished version, this would be a submenu
                                            const folderNames = folders
                                                .map((f) => f.name)
                                                .join(", ")
                                            const input = window.prompt(
                                                `${dict.folders?.moveToFolder || "Move to folder"}\n\nAvailable folders: ${folderNames || "(none)"}\n\nEnter folder name (or leave empty for Uncategorized):`,
                                            )
                                            if (input === null) return // cancelled
                                            if (input.trim() === "") {
                                                onMoveToFolder(session.id, null)
                                            } else {
                                                const folder = folders.find(
                                                    (f) =>
                                                        f.name.toLowerCase() ===
                                                        input
                                                            .trim()
                                                            .toLowerCase(),
                                                )
                                                if (folder) {
                                                    onMoveToFolder(
                                                        session.id,
                                                        folder.id,
                                                    )
                                                } else {
                                                    alert("Folder not found")
                                                }
                                            }
                                        }}
                                    >
                                        <FolderInput className="w-3.5 h-3.5 mr-2" />
                                        {dict.folders?.moveToFolder ||
                                            "Move to folder"}
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                    className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                    onClick={(e) => {
                                        stopProp(e)
                                        onDelete(session.id)
                                    }}
                                >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                                    {dict.common.delete}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                        {session.messageCount}{" "}
                        {dict.sessionHistory?.messages || "messages"}
                    </span>
                    <span>{dateLabel}</span>
                </div>
            </div>
        </div>
    )
}
