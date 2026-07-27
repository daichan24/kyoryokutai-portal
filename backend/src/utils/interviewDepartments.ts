export type DepartmentRename = {
  oldName: string;
  newName: string;
};

export function createDepartmentRenameMap(renames: DepartmentRename[]) {
  return new Map(renames.map(({ oldName, newName }) => [oldName.trim(), newName.trim()]));
}

export function renameDepartmentValue(value: string | null | undefined, renameMap: Map<string, string>) {
  if (!value) return value;
  return renameMap.get(value.trim()) ?? value;
}

export function renameDepartmentList(values: string[], renameMap: Map<string, string>) {
  return [...new Set(values.map((value) => renameDepartmentValue(value, renameMap)).filter((value): value is string => !!value))];
}
