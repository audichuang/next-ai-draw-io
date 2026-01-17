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
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
    folderId?: string | null
}

interface SessionGridCardProps {
    session: SessionMetadata
    lang: string
    folders?: FolderMetadata[]
    dict: {
        common: {
            edit: string
            delete: string
            rename: string
        }
        sessionHistory?: {
            messages?: string
        }
        folders?: {
            moveToFolder?: string
            noFolder?: string
            all?: string
            uncategorized?: string
            newFolder?: string
            folderNamePlaceholder?: string
        }
    }
    dateLabel: string
    onDelete: (id: string) => void
    onRename: (id: string) => void
    onMoveToFolder?: (sessionId: string, folderId: string | null) => void
}

export function SessionGridCard({
    session,
    lang,
    folders = [],
    dict,
    dateLabel,
    onDelete,
    onRename,
    onMoveToFolder,
}: SessionGridCardProps) {
    const router = useRouter()
    const [moveDialogOpen, setMoveDialogOpen] = useState(false)

    const handleClick = () => {
        router.push(`/${lang}/session/${session.id}`)
    }

    const stopProp = (e: React.MouseEvent) => e.stopPropagation()

    const handleMove = (folderId: string | null) => {
        if (onMoveToFolder) {
            onMoveToFolder(session.id, folderId)
        }
        setMoveDialogOpen(false)
    }

    return (
        <>
            <div
                role="button"
                tabIndex={0}
                onClick={handleClick}
                onKeyDown={(e) => e.key === "Enter" && handleClick()}
                className={cn(
                    "group relative flex flex-col rounded-xl cursor-pointer transition-all duration-200",
                    "bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg",
                    "overflow-hidden",
                )}
            >
                {/* Thumbnail */}
                <div className="relative aspect-[16/10] bg-muted/30 overflow-hidden">
                    {session.thumbnailDataUrl ? (
                        <Image
                            src={session.thumbnailDataUrl}
                            alt={session.title}
                            fill
                            className="object-contain p-2"
                            unoptimized
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <FileText className="w-12 h-12 text-muted-foreground/30" />
                        </div>
                    )}

                    {/* Hover overlay with actions */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>

                {/* Content */}
                <div className="p-3 flex flex-col gap-1.5">
                    {/* Title */}
                    <h3 className="font-medium text-sm text-foreground line-clamp-2 leading-tight min-h-[2.5rem]">
                        {session.title}
                    </h3>

                    {/* Meta row */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>{session.messageCount}</span>
                            <span className="mx-1">·</span>
                            <span>{dateLabel}</span>
                        </div>

                        {/* Actions dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={stopProp}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        stopProp(e)
                                        onRename(session.id)
                                    }}
                                >
                                    <Pencil className="w-3.5 h-3.5 mr-2" />
                                    {dict.common.rename}
                                </DropdownMenuItem>

                                {/* Move to Folder */}
                                {onMoveToFolder && (
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            stopProp(e)
                                            setMoveDialogOpen(true)
                                        }}
                                    >
                                        <FolderInput className="w-3.5 h-3.5 mr-2" />
                                        {dict.folders?.moveToFolder ||
                                            "Move to folder"}
                                    </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />
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
            </div>

            {/* Move to Folder Dialog */}
            <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
                <DialogContent className="max-w-xs" onClick={stopProp}>
                    <DialogHeader>
                        <DialogTitle>
                            {dict.folders?.moveToFolder || "Move to folder"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-1 py-2">
                        <Button
                            variant={!session.folderId ? "secondary" : "ghost"}
                            className="justify-start"
                            onClick={() => handleMove(null)}
                        >
                            {dict.folders?.noFolder || "None (Uncategorized)"}
                        </Button>
                        {folders.map((folder) => (
                            <Button
                                key={folder.id}
                                variant={
                                    session.folderId === folder.id
                                        ? "secondary"
                                        : "ghost"
                                }
                                className="justify-start"
                                onClick={() => handleMove(folder.id)}
                            >
                                {folder.name}
                            </Button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
