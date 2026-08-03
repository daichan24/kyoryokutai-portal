export function isCompleteAssignmentOrder(currentIds: string[], requestedIds: string[]) {
  if (currentIds.length !== requestedIds.length) return false;
  if (new Set(requestedIds).size !== requestedIds.length) return false;
  const requestedIdSet = new Set(requestedIds);
  return currentIds.every((id) => requestedIdSet.has(id));
}
