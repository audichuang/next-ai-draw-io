-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "xmlSnapshots" JSONB NOT NULL DEFAULT '[]',
    "diagramXml" TEXT,
    "diagramHistory" JSONB DEFAULT '[]',
    "thumbnailDataUrl" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "hasDiagram" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatSession_userId_updatedAt_idx" ON "ChatSession"("userId", "updatedAt" DESC);
