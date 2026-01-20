import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/sessions/[id] - Get a single session
export async function GET(_request: NextRequest, { params }: RouteParams) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    try {
        const chatSession = await prisma.chatSession.findUnique({
            where: { id, userId: session.user.id },
        })

        if (!chatSession) {
            return NextResponse.json(
                { error: "Session not found" },
                { status: 404 },
            )
        }

        return NextResponse.json(chatSession)
    } catch (error) {
        console.error("Failed to get session:", error)
        return NextResponse.json(
            { error: "Failed to get session" },
            { status: 500 },
        )
    }
}

// PUT /api/sessions/[id] - Update a session
export async function PUT(request: NextRequest, { params }: RouteParams) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    try {
        const body = await request.json()
        const {
            title,
            messages,
            xmlSnapshots,
            diagramXml,
            diagramHistory,
            thumbnailDataUrl,
            folderId,
        } = body

        const chatSession = await prisma.chatSession.update({
            where: { id, userId: session.user.id },
            data: {
                ...(title !== undefined && { title }),
                ...(messages !== undefined && {
                    messages,
                    messageCount: Array.isArray(messages) ? messages.length : 0,
                }),
                ...(xmlSnapshots !== undefined && { xmlSnapshots }),
                ...(diagramXml !== undefined && {
                    diagramXml,
                    hasDiagram: !!diagramXml && diagramXml.trim().length > 0,
                }),
                ...(diagramHistory !== undefined && { diagramHistory }),
                ...(thumbnailDataUrl !== undefined && { thumbnailDataUrl }),
                ...(folderId !== undefined && { folderId }),
            },
        })

        return NextResponse.json(chatSession)
    } catch (error) {
        console.error("Failed to update session:", error)
        return NextResponse.json(
            { error: "Failed to update session" },
            { status: 500 },
        )
    }
}

// DELETE /api/sessions/[id] - Delete a session
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    try {
        await prisma.chatSession.delete({
            where: { id, userId: session.user.id },
        })

        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error("Failed to delete session:", error)
        return NextResponse.json(
            { error: "Failed to delete session" },
            { status: 500 },
        )
    }
}
