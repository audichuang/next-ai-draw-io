import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/sessions - Get all sessions for authenticated user
export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    try {
        const sessions = await prisma.chatSession.findMany({
            where: { userId },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                title: true,
                createdAt: true,
                updatedAt: true,
                messageCount: true,
                hasDiagram: true,
                thumbnailDataUrl: true,
                folderId: true,
            },
        })

        return NextResponse.json(sessions)
    } catch (error) {
        console.error("Failed to get sessions:", error)
        return NextResponse.json(
            { error: "Failed to get sessions" },
            { status: 500 },
        )
    }
}

// POST /api/sessions - Create a new session
export async function POST(request: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    try {
        const body = await request.json()
        const {
            title,
            messages,
            xmlSnapshots,
            diagramXml,
            diagramHistory,
            thumbnailDataUrl,
        } = body

        const chatSession = await prisma.chatSession.create({
            data: {
                userId,
                title: title || "New Chat",
                messages: messages || [],
                xmlSnapshots: xmlSnapshots || [],
                diagramXml: diagramXml || null,
                diagramHistory: diagramHistory || [],
                thumbnailDataUrl: thumbnailDataUrl || null,
                messageCount: Array.isArray(messages) ? messages.length : 0,
                hasDiagram: !!diagramXml && diagramXml.trim().length > 0,
            },
        })

        return NextResponse.json(chatSession, { status: 201 })
    } catch (error) {
        console.error("Failed to create session:", error)
        return NextResponse.json(
            { error: "Failed to create session" },
            { status: 500 },
        )
    }
}
