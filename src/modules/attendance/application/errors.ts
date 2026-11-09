export class AttendanceRuleError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class EventIdConflictError extends AttendanceRuleError {
  constructor() {
    super('Event ID already belongs to a different attendance event', 409);
  }
}
