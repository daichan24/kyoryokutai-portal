#!/usr/bin/env tsx
/**
 * マイグレーション解決スクリプト
 * 
 * 失敗したマイグレーションや、既に手動で適用済みのマイグレーションを
 * _prisma_migrations テーブルに記録する。
 * 
 * 使用方法:
 *   npx tsx scripts/resolve-migrations.ts
 */

import { execSync } from 'child_process';

// 既に適用済みとしてマークするマイグレーション
const APPLIED_MIGRATIONS = [
  '20260123000000_add_event_updated_by',
  '20260124000000_add_document_template',
  '20260125000000_add_display_order_to_user',
  '20260126000000_add_wish_model',
  '20260127000000_add_theme_color_to_project',
  '20260127000001_add_wishes_enabled_to_user',
  '20260128000000_add_due_date_to_task',
  '20260129000000_add_status_to_event_participation',
  '20260130000000_add_start_end_date_to_schedule',
  '20260131000000_add_title_to_schedule',
  '20260131000001_add_start_end_date_to_event',
  '20260325000000_consultation_member_role_task_link',
  '20260326000000_activity_expenses',
  '20260327000000_announcements',
  '20260328000000_mandated_events_triage_schedule_event',
  '20260328103000_sns_follower_mandated_audit',
  '20260328140000_user_password_master_plain',
  '20260328160000_ukishima_government_role',
  '20260329000000_update_member_emails',
  '20260331120000_clearbase_sns_wishes_activity_expense',
  '20260403000000_add_government_attendance',
  '20260403000001_gov_attendance_add_time_enddate',
  '20260404000000_announcement_confirm_target',
  '20260405000000_schedule_custom_color',
  '20260406000000_sns_account',
  '20260407000000_add_project_achieved_contacts',
  '20260408000000_add_notepad',
  '20260409000000_add_leave_management',
  '20260409000001_add_schedule_dayoff_fields',
  '20260409000002_add_time_adjustment_usage_fields',
];

// ロールバック扱いにするマイグレーション（失敗したもの）
const ROLLED_BACK_MIGRATIONS = [
  '20260416000000_add_handover',
  '20260416154901_add_handover',
];

console.log('🔧 [MIGRATE] Resolving migrations...\n');

// 既に適用済みとしてマーク
console.log('📝 [MIGRATE] Marking migrations as applied...');
for (const migration of APPLIED_MIGRATIONS) {
  try {
    execSync(`npx prisma migrate resolve --applied ${migration}`, {
      stdio: 'inherit',
      encoding: 'utf-8',
    });
    console.log(`  ✅ ${migration}`);
  } catch (error) {
    // エラーは無視（既に適用済みの場合など）
    console.log(`  ⚠️  ${migration} (already resolved or error)`);
  }
}

console.log('\n🔄 [MIGRATE] Marking failed migrations as rolled back...');
for (const migration of ROLLED_BACK_MIGRATIONS) {
  try {
    execSync(`npx prisma migrate resolve --rolled-back ${migration}`, {
      stdio: 'inherit',
      encoding: 'utf-8',
    });
    console.log(`  ✅ ${migration}`);
  } catch (error) {
    // エラーは無視（既にロールバック済みの場合など）
    console.log(`  ⚠️  ${migration} (already resolved or error)`);
  }
}

console.log('\n✅ [MIGRATE] Migration resolution completed!');
console.log('💡 [MIGRATE] Run "npx prisma migrate deploy" to apply pending migrations.');
