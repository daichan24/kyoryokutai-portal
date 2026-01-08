import { addDays, getDay } from 'date-fns';

export interface Location {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  projectName: string;
}

export interface ParsedSchedule {
  date: Date | null;
  startTime: string | null;
  endTime: string | null;
  locationId: string | null;
  locationText: string | null;
  participants: string[];
  projectId: string | null;
  description: string;
  missingFields: string[];
}

/**
 * 自然文から予定情報を解析
 */
export function parseQuickInput(
  text: string,
  locations: Location[],
  users: User[],
  projects: Project[]
): ParsedSchedule {
  const result: ParsedSchedule = {
    date: null,
    startTime: null,
    endTime: null,
    locationId: null,
    locationText: null,
    participants: [],
    projectId: null,
    description: text,
    missingFields: [],
  };

  // 日付パース
  result.date = parseDateFromText(text);
  if (!result.date) result.missingFields.push('日付');

  // 時刻パース
  const timeResult = parseTimeFromText(text);
  result.startTime = timeResult.startTime;
  result.endTime = timeResult.endTime;
  if (!result.startTime || !result.endTime) result.missingFields.push('時刻');

  // 場所パース
  for (const location of locations) {
    if (text.includes(location.name)) {
      result.locationId = location.id;
      result.locationText = location.name;
      break;
    }
  }

  // 参加者パース（○○さん）
  const participantMatches = text.matchAll(/([^\s、,]+)さん/g);
  for (const match of participantMatches) {
    const name = match[1];
    const user = users.find((u) => u.name.includes(name));
    if (user) {
      result.participants.push(user.id);
    }
  }

  // プロジェクトパース
  for (const project of projects) {
    if (text.includes(project.projectName)) {
      result.projectId = project.id;
      break;
    }
  }

  return result;
}

/**
 * テキストから日付を解析
 */
function parseDateFromText(text: string): Date | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 今日
  if (text.match(/今日|きょう/)) {
    return today;
  }

  // 明日
  if (text.includes('明日')) {
    return addDays(today, 1);
  }

  // 明後日
  if (text.includes('明後日')) {
    return addDays(today, 2);
  }

  // 今週○曜日
  const dayMatch = text.match(/今週(月|火|水|木|金|土|日)曜日/);
  if (dayMatch) {
    const dayMap: Record<string, number> = {
      日: 0,
      月: 1,
      火: 2,
      水: 3,
      木: 4,
      金: 5,
      土: 6,
    };
    const targetDay = dayMap[dayMatch[1]];
    return getNextDayOfWeek(today, targetDay);
  }

  // MM/DD形式
  const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]);
    const day = parseInt(dateMatch[2]);
    const year = today.getFullYear();
    return new Date(year, month - 1, day);
  }

  // DD日
  const dayOnlyMatch = text.match(/(\d{1,2})日/);
  if (dayOnlyMatch) {
    const day = parseInt(dayOnlyMatch[1]);
    const month = today.getMonth();
    const year = today.getFullYear();
    return new Date(year, month, day);
  }

  return null;
}

/**
 * テキストから時刻を解析
 */
function parseTimeFromText(text: string): {
  startTime: string | null;
  endTime: string | null;
} {
  // HH:MM-HH:MM形式
  const timeMatch1 = text.match(/(\d{1,2}):(\d{2})[-~〜](\d{1,2}):(\d{2})/);
  if (timeMatch1) {
    return {
      startTime: `${timeMatch1[1].padStart(2, '0')}:${timeMatch1[2]}`,
      endTime: `${timeMatch1[3].padStart(2, '0')}:${timeMatch1[4]}`,
    };
  }

  // HH時-HH時形式
  const timeMatch2 = text.match(/(\d{1,2})時[-~〜](\d{1,2})時/);
  if (timeMatch2) {
    return {
      startTime: `${timeMatch2[1].padStart(2, '0')}:00`,
      endTime: `${timeMatch2[2].padStart(2, '0')}:00`,
    };
  }

  // HH時半形式
  const timeMatch3 = text.match(/(\d{1,2})時半/);
  if (timeMatch3) {
    return {
      startTime: `${timeMatch3[1].padStart(2, '0')}:30`,
      endTime: null,
    };
  }

  return { startTime: null, endTime: null };
}

/**
 * 次の指定曜日の日付を取得
 */
function getNextDayOfWeek(from: Date, targetDay: number): Date {
  const currentDay = getDay(from);
  let daysToAdd = targetDay - currentDay;
  if (daysToAdd <= 0) daysToAdd += 7;
  return addDays(from, daysToAdd);
}
