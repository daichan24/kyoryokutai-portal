/**
 * 既存メンバーに「協力隊業務」と「役場業務」のミッション・プロジェクトを作成するスクリプト
 */
import { createDefaultMissionsAndProjectsForExistingMembers } from '../src/services/defaultMissionProjectService';

async function main() {
  console.log('🚀 既存メンバーにデフォルトミッション・プロジェクトを作成します...\n');
  
  try {
    await createDefaultMissionsAndProjectsForExistingMembers();
    console.log('\n✅ 完了しました！');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

main();
