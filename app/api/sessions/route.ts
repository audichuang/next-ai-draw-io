import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// GET /api/sessions - Get all sessions for a user
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) {
        return NextResponse.json(
            { error: "userId is required" },
            { status: 400 },
        )
    }

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
    try {
        const body = await request.json()
        const {
            userId,
            title,
            messages,
            xmlSnapshots,
            diagramXml,
            diagramHistory,
            thumbnailDataUrl,
        } = body

        if (!userId) {
            return NextResponse.json(
                { error: "userId is required" },
                { status: 400 },
            )
        }

        const session = await prisma.chatSession.create({
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

        return NextResponse.json(session, { status: 201 })
    } catch (error) {
        console.error("Failed to create session:", error)
        return NextResponse.json(
            { error: "Failed to create session" },
            { status: 500 },
        )
    }
}
