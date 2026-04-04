# Implementation Plan: SNS投稿管理システム

## Overview

このプランは、既に実装済みのSNS投稿管理システムに対して、テストの追加とコードの改善を行います。システムは既に稼働しているため、既存機能を壊さないよう慎重に進めます。

## Tasks

- [x] 1. 週境界計算のユニットテスト作成
  - backend/src/utils/weekBoundary.tsの関数群をテスト
  - getCurrentWeekBoundary, getWeekBoundaryForDate, getWeekKey, jstWallToUtcDateをカバー
  - タイムゾーン境界のエッジケースを含める
  - _Requirements: 1.2, 1.3_

- [ ]* 2. 週境界計算のプロパティテスト作成
  - [ ]* 2.1 Property 1: Week Boundary Consistencyのテスト
    - **Property 1: Week Boundary Consistency**
    - **Validates: Requirements 1.2**
    - 任意の日時に対して、その週内の任意の時刻で週キーを計算しても同じ結果になることを検証
  
  - [ ]* 2.2 Property 10: Week Recalculation on Date Changeのテスト
    - **Property 10: Week Recalculation on Date Change**
    - **Validates: Requirements 9.2**
    - 投稿日を変更した際に週キーが正しく再計算されることを検証

- [x] 3. バリデーション関数のユニットテスト作成
  - [x] 3.1 フォロワー数バリデーションのテスト
    - 正常値（0, 1000, 99999999）
    - カンマ区切り入力（"1,000", "10,000,000"）
    - 境界値（-1, 100000000）
    - 無効な入力（文字列、null、undefined）
    - _Requirements: 5.2, 5.3_
  
  - [x] 3.2 URLバリデーションのテスト
    - 有効なURL（http, https）
    - 空文字列
    - 無効なURL
    - _Requirements: 10.4_
  
  - [x] 3.3 備考文字数制限のテスト
    - 2000文字以下
    - 2001文字以上
    - _Requirements: 10.5_

- [ ]* 4. 投稿種別独立性のプロパティテスト
  - [ ]* 4.1 Property 2: Post Type Independenceのテスト
    - **Property 2: Post Type Independence**
    - **Validates: Requirements 2.4**
    - 任意のユーザーと週に対して、STORY投稿の作成がFEED投稿の作成に影響しないことを検証

- [x] 5. SNSアカウント管理のユニットテスト作成
  - [x] 5.1 デフォルトアカウント設定のテスト
    - 最初のアカウントが自動的にデフォルトになることを確認
    - 新しいアカウントをデフォルトに設定すると他がfalseになることを確認
    - _Requirements: 3.2, 3.3, 3.4_
  
  - [x] 5.2 アカウント作成・更新・削除のテスト
    - 正常系フロー
    - 権限チェック（自分のアカウントのみ操作可能）
    - _Requirements: 3.1_

- [ ]* 6. デフォルトアカウントのプロパティテスト
  - [ ]* 6.1 Property 3: Default Account Uniquenessのテスト
    - **Property 3: Default Account Uniqueness**
    - **Validates: Requirements 3.2, 3.3**
    - 任意のユーザーに対して、アカウントをデフォルトに設定した後、そのユーザーのデフォルトアカウントが正確に1つであることを検証
  
  - [ ]* 6.2 Property 4: First Account Defaultのテスト
    - **Property 4: First Account Default**
    - **Validates: Requirements 3.4**
    - アカウントが0個のユーザーに対して、最初のアカウントを作成するとisDefault=trueになることを検証

- [x] 7. 週次ステータス計算のユニットテスト作成
  - [x] 7.1 4パターンのステータステスト
    - 両方完了（STORY + FEED）
    - STORYのみ完了
    - FEEDのみ完了
    - 両方未完了
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  
  - [x] 7.2 週境界のエッジケーステスト
    - 週の開始直後の投稿
    - 週の終了直前の投稿
    - 週境界をまたぐ投稿
    - _Requirements: 4.1_

- [ ]* 8. 週次ステータスのプロパティテスト
  - [ ]* 8.1 Property 5: Weekly Status Completenessのテスト
    - **Property 5: Weekly Status Completeness**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**
    - 任意のユーザーと週に対して、STORYとFEEDの両方の投稿が存在する場合、週次ステータスが両方完了を示すことを検証

- [x] 9. 日付範囲フィルタリングのユニットテスト作成
  - [x] 9.1 期間指定検索のテスト
    - fromのみ指定
    - toのみ指定
    - from + to指定
    - 境界値（月末、年末）
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 9.2 週指定検索のテスト（後方互換性）
    - 週キーでの検索
    - _Requirements: 8.4_

- [ ]* 10. 日付範囲フィルタリングのプロパティテスト
  - [ ]* 10.1 Property 7: Date Range Filteringのテスト
    - **Property 7: Date Range Filtering**
    - **Validates: Requirements 8.1, 8.2, 8.3**
    - 任意の日付範囲（from, to）に対して、返される全ての投稿のpostedAtがfrom以上かつto以下であることを検証

- [x] 11. Upsertロジックのユニットテスト作成
  - [x] 11.1 新規作成のテスト
    - 存在しない投稿の作成
    - _Requirements: 10.1_
  
  - [x] 11.2 更新のテスト
    - 同じuserId + week + postType + accountIdでの更新
    - _Requirements: 10.1_
  
  - [x] 11.3 P2002エラーハンドリングのテスト
    - unique制約違反時の再試行ロジック
    - _Requirements: 10.2_

- [ ]* 12. Upsert冪等性のプロパティテスト
  - [ ]* 12.1 Property 8: Upsert Idempotenceのテスト
    - **Property 8: Upsert Idempotence**
    - **Validates: Requirements 10.1, 10.2**
    - 任意の投稿データに対して、同じuserId + week + postType + accountIdで複数回作成を試みても、最終的に1つのレコードのみが存在し、最新のデータが保存されることを検証

- [x] 13. 認可チェックのユニットテスト作成
  - [x] 13.1 投稿の編集・削除権限テスト
    - MEMBERは自分の投稿のみ編集・削除可能
    - 他人の投稿は403エラー
    - MASTERは全ての投稿を編集・削除可能
    - _Requirements: 9.4, 9.5, 9.6_
  
  - [x] 13.2 アカウントの編集・削除権限テスト
    - 自分のアカウントのみ操作可能
    - MASTERは全てのアカウントを操作可能
    - _Requirements: 3.1_
  
  - [x] 13.3 閲覧権限テスト
    - MEMBERは自分の投稿のみ取得可能
    - Staffは全ユーザーの投稿を取得可能
    - _Requirements: 8.5_

- [ ]* 14. 認可境界のプロパティテスト
  - [ ]* 14.1 Property 9: Authorization Boundaryのテスト
    - **Property 9: Authorization Boundary**
    - **Validates: Requirements 9.4, 9.5**
    - 任意のMEMBERユーザーに対して、他のユーザーの投稿を編集・削除しようとすると403エラーが返されることを検証

- [x] 15. 月次ステータス計算のユニットテスト作成
  - [x] 15.1 今月の投稿有無判定テスト
    - 今月にSTORY投稿がある場合
    - 今月にFEED投稿がある場合
    - 今月に投稿がない場合
    - 月境界のエッジケース
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

- [ ]* 16. 月次ステータスのプロパティテスト
  - [ ]* 16.1 Property 13: Month Status Calculationのテスト
    - **Property 13: Month Status Calculation**
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.5**
    - 任意のユーザーと月に対して、その月内に特定タイプの投稿が少なくとも1つ存在する場合、月次ステータスがtrueになることを検証

- [x] 17. 年度ベース月選択のユニットテスト作成
  - [x] 17.1 利用可能な月リスト生成テスト
    - 現在の年度の月（4月〜翌年3月）
    - 前年度の最後の3ヶ月
    - 降順ソート
    - _Requirements: 12.1, 12.2, 12.3_

- [ ]* 18. 年度月包含のプロパティテスト
  - [ ]* 18.1 Property 14: Fiscal Year Month Inclusionのテスト
    - **Property 14: Fiscal Year Month Inclusion**
    - **Validates: Requirements 12.1, 12.2**
    - 任意の現在日付に対して、利用可能な月リストが現在の年度の全ての月と前年度の最後の3ヶ月を含むことを検証

- [x] 19. フォロワー数グラフのユニットテスト作成
  - [x] 19.1 データポイント生成テスト
    - フォロワー数がnullの投稿は除外
    - 日付順にソート
    - _Requirements: 5.5, 5.6_
  
  - [x] 19.2 グラフ座標計算テスト
    - X軸座標計算
    - Y軸座標計算（最小値・最大値のスケーリング）
    - _Requirements: 5.6_

- [ ]* 20. フォロワー数バリデーションのプロパティテスト
  - [ ]* 20.1 Property 6: Follower Count Validationのテスト
    - **Property 6: Follower Count Validation**
    - **Validates: Requirements 5.2, 5.3**
    - 任意のフォロワー数入力に対して、数字とカンマのみを含み、数値が0〜99,999,999の範囲内であれば受け入れられることを検証

- [~] 21. APIエンドポイントの統合テスト作成
  - [~] 21.1 POST /api/sns-posts統合テスト
    - 新規作成フロー
    - 更新フロー（同じweek + postType）
    - 並行リクエストでのupsert
    - _Requirements: 1.1, 10.1, 10.2_
  
  - [~] 21.2 GET /api/sns-posts統合テスト
    - 期間指定フィルタ
    - ユーザー指定フィルタ
    - アカウント指定フィルタ
    - 権限チェック
    - _Requirements: 8.1, 8.2, 8.3, 8.5_
  
  - [~] 21.3 GET /api/sns-posts/weekly-status統合テスト
    - 現在の週のステータス計算
    - 自動更新（60秒間隔）
    - _Requirements: 4.1, 4.6_
  
  - [~] 21.4 SNSアカウントAPI統合テスト
    - アカウント作成・更新・削除フロー
    - デフォルトフラグ管理
    - 権限チェック
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ]* 22. URLバリデーションのプロパティテスト
  - [ ]* 22.1 Property 11: URL Validationのテスト
    - **Property 11: URL Validation**
    - **Validates: Requirements 10.4**
    - 任意のURL入力に対して、空文字列または有効なURL形式であれば受け入れられ、それ以外は拒否されることを検証

- [ ]* 23. 備考長さ制限のプロパティテスト
  - [ ]* 23.1 Property 12: Note Length Limitのテスト
    - **Property 12: Note Length Limit**
    - **Validates: Requirements 10.5**
    - 任意の備考入力に対して、2000文字を超える場合は拒否されることを検証

- [x] 24. エラーハンドリングのユニットテスト作成
  - [x] 24.1 バリデーションエラー（400）のテスト
    - 無効な日付形式
    - 無効なpostType
    - 無効なURL
    - 備考の文字数超過
    - フォロワー数の範囲外
    - 必須フィールドの欠落
  
  - [x] 24.2 認可エラー（403）のテスト
    - MEMBERの他ユーザーデータアクセス
    - 非Staffのスタッフ専用エンドポイントアクセス
  
  - [x] 24.3 Not Foundエラー（404）のテスト
    - 存在しない投稿ID
    - 存在しないアカウントID

- [x] 25. Checkpoint - テスト実行と確認
  - 全てのユニットテストが成功することを確認
  - 全てのプロパティテストが成功することを確認（各100回以上実行）
  - カバレッジレポートを確認
  - ユーザーに質問があれば確認

- [x] 26. コードの改善とリファクタリング
  - [x] 26.1 週境界計算ロジックの整理
    - 重複コードの削除
    - 型定義の明確化
    - _Requirements: 1.2, 1.3_
  
  - [x] 26.2 Upsertロジックの簡素化
    - P2002エラーハンドリングの改善
    - リトライロジックの明確化
    - _Requirements: 10.1, 10.2_
  
  - [x] 26.3 バリデーションロジックの統一
    - Zodスキーマの整理
    - エラーメッセージの統一
    - _Requirements: 10.4, 10.5_

- [x] 27. ドキュメントの整備
  - [x] 27.1 API仕様書の作成
    - 全エンドポイントの詳細
    - リクエスト・レスポンス例
    - エラーコード一覧
  
  - [x] 27.2 週境界計算の説明ドキュメント
    - 月曜日9:00 JST起算の説明
    - 週キー形式の説明
    - タイムゾーン変換の注意点
  
  - [x] 27.3 運用ガイドの作成
    - データバックアップ手順
    - トラブルシューティング
    - よくある質問

- [x] 28. Final Checkpoint - 全体確認
  - 全てのテストが成功することを確認
  - ドキュメントが完成していることを確認
  - 既存機能が正常に動作することを確認
  - ユーザーに最終確認

## Notes

- タスクに`*`が付いているものはオプションで、より速いMVPのためにスキップ可能です
- 各タスクは特定の要件を参照しており、トレーサビリティを確保しています
- チェックポイントで段階的な検証を行い、問題を早期に発見します
- プロパティテストは各100回以上実行し、包括的な正当性を検証します
- ユニットテストは特定の例とエッジケースを検証します
- 既存の実装を壊さないよう、テストを先に作成してから改善を行います
