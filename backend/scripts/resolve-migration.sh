#!/bin/bash

# P3009 エラー解決スクリプト
# 使用方法: ./scripts/resolve-migration.sh

set -e

echo "🔧 P3009 エラー解決スクリプト"
echo ""

# DATABASE_URL が設定されているか確認
if [ -z "$DATABASE_URL" ]; then
  echo "❌ エラー: DATABASE_URL が設定されていません"
  echo ""
  echo "使用方法:"
  echo "  export DATABASE_URL=\"<本番環境のExternal Database URL>\""
  echo "  ./scripts/resolve-migration.sh"
  echo ""
  exit 1
fi

echo "📋 マイグレーションの状態を確認..."
npx prisma migrate status

echo ""
echo "🔍 失敗したマイグレーションを解決..."
npx prisma migrate resolve --applied 20260119000000_fix_snspost_week_format

echo ""
echo "✅ 解決完了"
echo ""
echo "📋 マイグレーションの状態を再確認..."
npx prisma migrate status

echo ""
echo "✨ 次のステップ:"
echo "  1. 環境変数をクリア: unset DATABASE_URL"
echo "  2. コードをプッシュして Render で再デプロイ"

