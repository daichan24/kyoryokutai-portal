#!/bin/bash

# データベースバックアップスクリプト
# 使用方法: ./backup-database.sh [出力ディレクトリ]

set -e

# 出力ディレクトリの設定
OUTPUT_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${OUTPUT_DIR}/backup_${TIMESTAMP}.dump"

# 出力ディレクトリの作成
mkdir -p "$OUTPUT_DIR"

echo "📦 データベースバックアップを開始します..."

# DATABASE_URL が設定されているか確認
if [ -z "$DATABASE_URL" ]; then
    echo "❌ エラー: DATABASE_URL 環境変数が設定されていません"
    echo ""
    echo "以下のいずれかの方法で設定してください:"
    echo "1. 環境変数として設定: export DATABASE_URL='postgresql://user:password@host:port/database'"
    echo "2. .env ファイルから読み込む: source .env"
    echo "3. 直接指定: DATABASE_URL='postgresql://...' ./backup-database.sh"
    exit 1
fi

echo "✅ DATABASE_URL を検出しました"
echo "📁 バックアップファイル: $BACKUP_FILE"

# バックアップの実行
if pg_dump "$DATABASE_URL" -F c -f "$BACKUP_FILE"; then
    echo "✅ バックアップが正常に完了しました"
    echo "📦 ファイル: $BACKUP_FILE"
    
    # ファイルサイズを表示
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "📊 ファイルサイズ: $FILE_SIZE"
    
    # バックアップファイルの整合性を確認
    echo "🔍 バックアップファイルの整合性を確認中..."
    if pg_restore --list "$BACKUP_FILE" > /dev/null 2>&1; then
        echo "✅ バックアップファイルは有効です"
    else
        echo "⚠️  警告: バックアップファイルの整合性確認に失敗しました"
    fi
else
    echo "❌ エラー: バックアップに失敗しました"
    exit 1
fi

echo ""
echo "🎉 バックアップ完了！"
echo "💡 復元する場合: pg_restore -d <database> $BACKUP_FILE"

