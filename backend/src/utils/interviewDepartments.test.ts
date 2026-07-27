import { describe, expect, test } from 'vitest';
import {
  createDepartmentRenameMap,
  renameDepartmentList,
  renameDepartmentValue,
} from './interviewDepartments';

describe('interview department renaming', () => {
  test('renames a department after trimming the stored label', () => {
    const renameMap = createDepartmentRenameMap([{ oldName: '企画課', newName: '企画政策課' }]);

    expect(renameDepartmentValue(' 企画課 ', renameMap)).toBe('企画政策課');
    expect(renameDepartmentValue('総務課', renameMap)).toBe('総務課');
  });

  test('renames unavailable departments without leaving duplicates', () => {
    const renameMap = createDepartmentRenameMap([
      { oldName: '旧企画課', newName: '企画課' },
      { oldName: '企画課', newName: '政策課' },
    ]);

    expect(renameDepartmentList(['旧企画課', '旧企画課', '企画課', '総務課'], renameMap)).toEqual([
      '企画課',
      '政策課',
      '総務課',
    ]);
  });
});
