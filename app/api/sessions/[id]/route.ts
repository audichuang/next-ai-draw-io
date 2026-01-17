import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/sessions/[id] - Get a single session
export async function GET(_request: NextRequest, { params }: RouteParams) {
    const { id } = await params

    try {
        const session = await prisma.chatSession.findUnique({
            where: { id },
        })

        if (!session) {
            return NextResponse.json(
                { error: "Session not found" },
                { status: 404 },
            )
        }

        return NextResponse.json(session)
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

        const session = await prisma.chatSession.update({
            where: { id },
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
                // folderId can be null (to move to uncategorized) or a string
                ...(folderId !== undefined && { folderId }),
            },
        })

        return NextResponse.json(session)
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
    const { id } = await params

    try {
        await prisma.chatSession.delete({
            where: { id },
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
