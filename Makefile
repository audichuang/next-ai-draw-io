.PHONY: help check check-fast check-build typecheck lint test test-e2e build dev start clean format db-push db-studio db-migrate db-generate

# 默認目標：顯示幫助
# ============================================================================
# AI Agent 注意：此 help 為精簡版，節省 token。關鍵規則：
# 1. commit 前必跑 check-fast，push 前必跑 check-build
# ============================================================================
help:
	@echo "🚀 Quality Gates (必用):"
	@echo "  check-fast   TS+Lint+Test    ⭐commit前"
	@echo "  check-build  +Build          🚀push前"
	@echo ""
	@echo "🔧 Dev: dev | format | build | typecheck | lint | test | test-e2e"
	@echo ""
	@echo "💾 DB: db-push | db-studio | db-migrate | db-generate"
	@echo ""
	@echo "🖥️  Electron: electron-dev | dist-mac | dist-win | dist-linux"

# TypeScript 類型檢查
typecheck:
	@printf "🔍 TypeScript... "
	@RESULT=$$(npx tsc --noEmit 2>&1); \
	if echo "$$RESULT" | grep -qE "error TS|Error:"; then \
		echo "❌ FAILED"; \
		echo "$$RESULT" | grep -E "(error TS|\.tsx?\([0-9])" | head -10; \
		exit 1; \
	else \
		echo "✅"; \
	fi

# Biome 代碼質量檢查
lint:
	@printf "🧹 Biome lint... "
	@RESULT=$$(npm run lint 2>&1); \
	if echo "$$RESULT" | grep -qE "Some errors were emitted|✖|error\["; then \
		echo "❌ FAILED"; \
		echo "$$RESULT" | grep -E "^(Checked|Found|[^ ].*\.(ts|tsx):|  ×|error\[)" | head -10; \
		exit 1; \
	else \
		echo "✅"; \
	fi

# 單元測試 (Vitest)
test:
	@printf "🧪 Unit tests... "
	@RESULT=$$(npm test -- --run 2>&1 | sed 's/\x1b\[[0-9;]*m//g'); \
	if echo "$$RESULT" | grep -qE "FAIL|failed"; then \
		echo "❌ FAILED"; \
		echo "$$RESULT" | grep -E "FAIL|Error|failed" | head -15; \
		exit 1; \
	else \
		echo "✅"; \
		echo "$$RESULT" | grep -E "Test Files|Tests |Duration" | tail -3; \
	fi

# E2E 測試 (Playwright)
test-e2e:
	@echo "🎭 Running E2E tests..."
	@npm run test:e2e

# 生產構建
build:
	@printf "🏗️  Building... "
	@RESULT=$$(npm run build 2>&1); \
	if echo "$$RESULT" | grep -qE "⨯|ERROR:|failed to|Error:"; then \
		echo "❌ FAILED"; \
		echo "$$RESULT" | grep -E "(⨯|ERROR:|Error:)" | head -20; \
		exit 1; \
	else \
		echo "✅"; \
	fi

# 快速檢查（基礎）
check:
	@$(MAKE) typecheck || exit 1
	@$(MAKE) lint || exit 1

# 完整快速檢查（推薦 - commit 前必跑）
check-fast:
	@$(MAKE) typecheck || exit 1
	@$(MAKE) lint || exit 1
	@$(MAKE) test || exit 1
	@echo ""
	@echo "✅ Fast check completed (TypeScript + Lint + Tests)!"

# 構建檢查（push 前必跑）
check-build:
	@$(MAKE) check-fast || exit 1
	@$(MAKE) build || exit 1
	@echo ""
	@echo "✅ Build check completed!"

# 完整檢查（含 E2E）
check-all:
	@$(MAKE) check-build || exit 1
	@$(MAKE) test-e2e || exit 1
	@echo ""
	@echo "✅ All checks completed!"

# 清理構建產物
clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf .next coverage node_modules/.cache test-results playwright-report
	@echo "✅ Clean completed"

# Biome 自動修復代碼格式
format:
	@echo "✨ Auto-fixing with Biome..."
	@npm run format
	@echo "✅ Code formatted!"

# 啟動開發伺服器
dev:
	@echo "🚀 Starting development server on http://localhost:6002..."
	@npm run dev

# 啟動生產伺服器
start:
	@echo "🚀 Starting production server..."
	@npm run start

# ============================================================================
# 資料庫管理指令 (Prisma)
# ============================================================================
db-push:
	@echo "📤 Pushing database schema..."
	@npx prisma db push

db-studio:
	@echo "🎨 Opening Prisma Studio..."
	@npx prisma studio

db-migrate:
	@echo "🔄 Running migrations..."
	@npx prisma migrate dev

db-generate:
	@echo "🔧 Generating Prisma Client..."
	@npx prisma generate

# ============================================================================
# Electron 桌面應用
# ============================================================================
electron-dev:
	@echo "🖥️  Starting Electron dev mode..."
	@npm run electron:dev

dist-mac:
	@echo "🍎 Building macOS version..."
	@npm run dist:mac

dist-win:
	@echo "🪟 Building Windows version..."
	@npm run dist:win

dist-linux:
	@echo "🐧 Building Linux version..."
	@npm run dist:linux
