export const TASK_STATUSES = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
};

const taskStatusSet = new Set(Object.values(TASK_STATUSES));

export function isValidTaskStatus(status) {
  return taskStatusSet.has(status);
}
