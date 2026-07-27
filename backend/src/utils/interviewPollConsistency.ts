type AvailabilityRow = {
  memberId: string;
  dateId: string;
  status: 'OK' | 'NG';
};

type AssignmentRow = {
  id: string;
  memberId: string;
  dateId: string;
  member?: { department?: string | null };
  date?: { unavailableDepartments?: string[] };
};

type DateRow = {
  id: string;
  capacity: number;
};

export function getInterviewPollAssignmentConsistency(input: {
  availability: AvailabilityRow[];
  assignments: AssignmentRow[];
  dates: DateRow[];
}) {
  const availabilityByMemberAndDate = new Map(
    input.availability.map((availability) => [
      `${availability.memberId}:${availability.dateId}`,
      availability.status,
    ]),
  );
  const assignedCounts = new Map<string, number>();
  const issues = input.assignments.flatMap((assignment) => {
    assignedCounts.set(assignment.dateId, (assignedCounts.get(assignment.dateId) || 0) + 1);
    const reasons: string[] = [];
    if (availabilityByMemberAndDate.get(`${assignment.memberId}:${assignment.dateId}`) !== 'OK') {
      reasons.push('本人回答がOKではありません');
    }
    const department = (assignment.member?.department || '').trim();
    if (department && assignment.date?.unavailableDepartments?.includes(department)) {
      reasons.push(`${department}が課NGです`);
    }
    return reasons.length > 0
      ? [{
        assignmentId: assignment.id,
        memberId: assignment.memberId,
        dateId: assignment.dateId,
        reasons,
      }]
      : [];
  });

  for (const date of input.dates) {
    if ((assignedCounts.get(date.id) || 0) > date.capacity) {
      issues.push({
        assignmentId: '',
        memberId: '',
        dateId: date.id,
        reasons: [`定員${date.capacity}名を超えています`],
      });
    }
  }

  return {
    consistent: issues.length === 0,
    issues,
  };
}
