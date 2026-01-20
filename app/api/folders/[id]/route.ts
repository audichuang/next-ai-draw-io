import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// PUT /api/folders/[id] - Rename a folder
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    try {
        const body = await request.json()
        const { name } = body

        if (!name?.trim()) {
            return NextResponse.json(
                { error: "name is required" },
                { status: 400 },
            )
        }

        const folder = await prisma.folder.update({
            where: { id, userId: session.user.id },
            data: { name: name.trim() },
        })

        return NextResponse.json({
            id: folder.id,
            name: folder.name,
            createdAt: folder.createdAt.toISOString(),
            updatedAt: folder.updatedAt.toISOString(),
        })
    } catch (error) {
        console.error("Failed to update folder:", error)
        return NextResponse.json(
            { error: "Failed to update folder" },
            { status: 500 },
        )
    }
}

// DELETE /api/folders/[id] - Delete a folder (sessions move to uncategorized)
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    try {
        // First, unlink all sessions from this folder (move to uncategorized)
        await prisma.chatSession.updateMany({
            where: { folderId: id, userId: session.user.id },
            data: { folderId: null },
        })

        // Then delete the folder
        await prisma.folder.delete({
            where: { id, userId: session.user.id },
        })

        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error("Failed to delete folder:", error)
        return NextResponse.json(
            { error: "Failed to delete folder" },
            { status: 500 },
        )
    }
}
