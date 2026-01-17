"use client"

import { Folder, FolderPlus, MoreVertical, Pencil, Trash2 } from "lucide-react"
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
import { cn } from "@/lib/utils"

interface FolderSidebarProps {
    folders: FolderMetadata[]
    selectedFolderId: string | null // null = "All", "uncategorized" = no folder
    onSelectFolder: (folderId: string | null) => void
    onCreateFolder: (name: string) => void
    onRenameFolder: (id: string, newName: string) => void
    onDeleteFolder: (id: string) => void
    dict: {
        common: { rename: string; delete: string; save: string; cancel: string }
        folders?: {
            all?: string
            uncategorized?: string
            newFolder?: string
            folderNamePlaceholder?: string
        }
    }
}

export function FolderSidebar({
    folders,
    selectedFolderId,
    onSelectFolder,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    dict,
}: FolderSidebarProps) {
    const [isCreating, setIsCreating] = useState(false)
    const [newFolderName, setNewFolderName] = useState("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isCreating || editingId) {
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [isCreating, editingId])

    const handleCreateSubmit = () => {
        if (newFolderName.trim()) {
            onCreateFolder(newFolderName.trim())
            setNewFolderName("")
        }
        setIsCreating(false)
    }

    const handleEditSubmit = (id: string) => {
        if (editName.trim()) {
            onRenameFolder(id, editName.trim())
        }
        setEditingId(null)
    }

    const startEditing = (folder: FolderMetadata) => {
        setEditingId(folder.id)
        setEditName(folder.name)
    }

    return (
        <div className="flex flex-col h-full bg-muted/30 border-r border-border/50">
            {/* Header */}
            <div className="p-3 border-b border-border/50 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                    {dict.folders?.all || "Folders"}
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setIsCreating(true)}
                    title={dict.folders?.newFolder || "New Folder"}
                >
                    <FolderPlus className="h-4 w-4" />
                </Button>
            </div>

            {/* Folder List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {/* All Sessions */}
                <button
                    type="button"
                    onClick={() => onSelectFolder(null)}
                    className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                        selectedFolderId === null
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-accent text-muted-foreground hover:text-foreground",
                    )}
                >
                    <Folder className="h-4 w-4" />
                    <span>{dict.folders?.all || "All Sessions"}</span>
                </button>

                {/* Uncategorized */}
                <button
                    type="button"
                    onClick={() => onSelectFolder("uncategorized")}
                    className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                        selectedFolderId === "uncategorized"
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-accent text-muted-foreground hover:text-foreground",
                    )}
                >
                    <Folder className="h-4 w-4" />
                    <span>
                        {dict.folders?.uncategorized || "Uncategorized"}
                    </span>
                </button>

                {/* Divider */}
                {folders.length > 0 && (
                    <div className="my-2 border-t border-border/50" />
                )}

                {/* User Folders */}
                {folders.map((folder) => (
                    <div key={folder.id} className="group relative">
                        {editingId === folder.id ? (
                            <Input
                                ref={inputRef}
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                        handleEditSubmit(folder.id)
                                    if (e.key === "Escape") setEditingId(null)
                                }}
                                onBlur={() => handleEditSubmit(folder.id)}
                                className="h-8 text-sm"
                            />
                        ) : (
                            <button
                                type="button"
                                onClick={() => onSelectFolder(folder.id)}
                                className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors pr-8",
                                    selectedFolderId === folder.id
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "hover:bg-accent text-muted-foreground hover:text-foreground",
                                )}
                            >
                                <Folder className="h-4 w-4 shrink-0" />
                                <span className="truncate">{folder.name}</span>
                                <span className="ml-auto text-xs opacity-60">
                                    {folder.sessionCount}
                                </span>
                            </button>
                        )}

                        {/* Folder Actions */}
                        {editingId !== folder.id && (
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <MoreVertical className="h-3.5 w-3.5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="w-28"
                                    >
                                        <DropdownMenuItem
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                startEditing(folder)
                                            }}
                                        >
                                            <Pencil className="h-3.5 w-3.5 mr-2" />
                                            {dict.common.rename}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="text-red-600 focus:text-red-700"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onDeleteFolder(folder.id)
                                            }}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                                            {dict.common.delete}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </div>
                ))}

                {/* New Folder Input */}
                {isCreating && (
                    <div className="px-1">
                        <Input
                            ref={inputRef}
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleCreateSubmit()
                                if (e.key === "Escape") {
                                    setIsCreating(false)
                                    setNewFolderName("")
                                }
                            }}
                            onBlur={handleCreateSubmit}
                            placeholder={
                                dict.folders?.folderNamePlaceholder ||
                                "Folder name"
                            }
                            className="h-8 text-sm"
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
