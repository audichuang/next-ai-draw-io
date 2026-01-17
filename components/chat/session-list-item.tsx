"use client"

import {
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import type { FolderMetadata } from "@/lib/session-storage"
import { cn } from "@/lib/utils"

export interface SessionMetadata {
    id: string
    title: string
    createdAt: string
    updatedAt: string
    messageCount: number
    hasDiagram: boolean
    thumbnailDataUrl?: string
}

interface SessionListItemProps {
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

export function SessionListItem({
    session,
    folders = [],
    dict,
    dateLabel,
    onSelect,
    onDelete,
    onRename,
    onMoveToFolder,
}: SessionListItemProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(session.title)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isEditing) {
            setEditValue(session.title)
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

    const stopProp = (e: React.MouseEvent) => e.stopPropagation()

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => !isEditing && onSelect(session.id)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !isEditing)
                                onSelect(session.id)
                        }}
                        className={cn(
                            "group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
                            "hover:bg-accent/60 border border-transparent hover:border-border/50",
                        )}
                    >
                        {/* Title or Edit Input */}
                        <div className="flex-1 min-w-0">
                            {isEditing ? (
                                <Input
                                    ref={inputRef}
                                    value={editValue}
                                    onChange={(e) =>
                                        setEditValue(e.target.value)
                                    }
                                    onKeyDown={handleKeyDown}
                                    onBlur={handleSave}
                                    onClick={stopProp}
                                    className="h-7 text-sm"
                                />
                            ) : (
                                <span className="block text-sm font-medium text-foreground truncate">
                                    {session.title}
                                </span>
                            )}
                        </div>

                        {/* Message Count */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                            <MessageSquare className="h-3 w-3" />
                            <span>{session.messageCount}</span>
                        </div>

                        {/* Date */}
                        <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
                            {dateLabel}
                        </span>

                        {/* Actions - show on hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={stopProp}>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                    >
                                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-40"
                                >
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            stopProp(e)
                                            setIsEditing(true)
                                        }}
                                    >
                                        <Pencil className="w-3.5 h-3.5 mr-2" />
                                        {dict.common.rename}
                                    </DropdownMenuItem>
                                    {onMoveToFolder && (
                                        <DropdownMenuItem
                                            onClick={(e) => {
                                                stopProp(e)
                                                const folderNames = folders
                                                    .map((f) => f.name)
                                                    .join(", ")
                                                const input = window.prompt(
                                                    `${dict.folders?.moveToFolder || "Move to folder"}\n\nFolders: ${folderNames || "(none)"}\n\nEnter folder name (empty = uncategorized):`,
                                                )
                                                if (input === null) return
                                                if (input.trim() === "") {
                                                    onMoveToFolder(
                                                        session.id,
                                                        null,
                                                    )
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
                                        className="text-red-600 focus:text-red-700"
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
                    </div>
                </TooltipTrigger>
                {/* Hover Preview - Show Thumbnail */}
                {session.thumbnailDataUrl && (
                    <TooltipContent
                        side="right"
                        sideOffset={8}
                        className="p-1 bg-background border shadow-lg"
                    >
                        <Image
                            src={session.thumbnailDataUrl}
                            alt={session.title}
                            width={280}
                            height={180}
                            className="rounded object-contain max-h-[180px] w-auto"
                            unoptimized
                        />
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    )
}
