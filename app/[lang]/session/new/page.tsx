"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createEmptySession } from "@/lib/session-storage"

export default function NewSessionPage() {
    const router = useRouter()
    const params = useParams()
    const lang = params.lang as string
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function createAndRedirect() {
            try {
                const session = await createEmptySession()
                if (session) {
                    router.replace(`/${lang}/session/${session.id}`)
                } else {
                    setError("Failed to create session")
                }
            } catch (err) {
                console.error("Failed to create new session:", err)
                setError("Failed to create session")
            }
        }

        createAndRedirect()
    }, [lang, router])

    if (error) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <p className="text-red-500 mb-4">{error}</p>
                    <button
                        type="button"
                        onClick={() => router.push(`/${lang}`)}
                        className="text-primary underline"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen flex items-center justify-center bg-background">
            <div className="text-center">
                <div className="animate-pulse text-muted-foreground">
                    Creating new session...
                </div>
            </div>
        </div>
    )
}
