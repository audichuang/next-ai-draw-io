import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// GET /api/folders - List all folders for a user
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
        return NextResponse.json(
            { error: "userId is required" },
            { status: 400 },
        )
    }

    try {
        const folders = await prisma.folder.findMany({
            where: { userId },
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: { sessions: true },
                },
            },
        })

        // Transform to include sessionCount
        const result = folders.map((f) => ({
            id: f.id,
            name: f.name,
            createdAt: f.createdAt.toISOString(),
            updatedAt: f.updatedAt.toISOString(),
            sessionCount: f._count.sessions,
        }))

        return NextResponse.json(result)
    } catch (error) {
        console.error("Failed to get folders:", error)
        return NextResponse.json(
            { error: "Failed to get folders" },
            { status: 500 },
        )
    }
}

// POST /api/folders - Create a new folder
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { userId, name } = body

        if (!userId || !name?.trim()) {
            return NextResponse.json(
                { error: "userId and name are required" },
                { status: 400 },
            )
        }

        const folder = await prisma.folder.create({
            data: {
                userId,
                name: name.trim(),
            },
        })

        return NextResponse.json({
            id: folder.id,
            name: folder.name,
            createdAt: folder.createdAt.toISOString(),
            updatedAt: folder.updatedAt.toISOString(),
            sessionCount: 0,
        })
    } catch (error) {
        console.error("Failed to create folder:", error)
        return NextResponse.json(
            { error: "Failed to create folder" },
            { status: 500 },
        )
    }
}
