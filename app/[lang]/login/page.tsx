"use client"

import { signIn } from "next-auth/react"
import { FcGoogle } from "react-icons/fc"

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Next AI Draw.io</h1>
                    <p className="text-muted-foreground">
                        Sign in to save your diagrams and chat history
                    </p>
                </div>

                <button
                    onClick={() => signIn("google", { callbackUrl: "/" })}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
                >
                    <FcGoogle className="w-5 h-5" />
                    <span>Sign in with Google</span>
                </button>
            </div>
        </div>
    )
}
