export function requiresScheduleLocation(input: {
  isDayOff?: boolean;
  locationText?: string | null;
}): boolean {
  return !input.isDayOff && !input.locationText?.trim();
}
