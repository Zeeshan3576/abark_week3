import { prisma } from "../lib/prisma.js";
import { createHttpError } from "../lib/http.js";

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  attachmentPath: true,
  attachmentOriginalName: true,
  attachmentMimeType: true,
  internId: true,
  createdAt: true,
  updatedAt: true,
  intern: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

function toPublicTask(task) {
  if (!task) return null;
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    attachmentPath: task.attachmentPath,
    attachmentOriginalName: task.attachmentOriginalName,
    attachmentMimeType: task.attachmentMimeType,
    internId: task.internId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    intern: task.intern
      ? {
          id: task.intern.id,
          name: task.intern.name,
          email: task.intern.email,
        }
      : null,
  };
}

function mapInternMissingError(err) {
  if (err?.code === "P2003" || err?.code === "P2018" || err?.code === "P2025") {
    return createHttpError(404, "Intern not found");
  }

  return null;
}

export async function createTask({ title, description = null, internId }) {
  try {
    const task = await prisma.task.create({
      data: {
        title,
        description,
        intern: {
          connect: { id: internId },
        },
      },
      select: taskSelect,
    });

    return toPublicTask(task);
  } catch (err) {
    const mapped = mapInternMissingError(err);
    if (mapped) throw mapped;
    throw err;
  }
}

export async function listTasks({ internId } = {}) {
  const tasks = await prisma.task.findMany({
    where: Number.isInteger(internId) && internId > 0 ? { internId } : undefined,
    orderBy: { id: "asc" },
    select: taskSelect,
  });

  return tasks.map(toPublicTask);
}

export async function getTaskById(id) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: taskSelect,
  });

  return toPublicTask(task);
}

export async function updateTaskStatus(id, status) {
  try {
    const task = await prisma.task.update({
      where: { id },
      data: { status },
      select: taskSelect,
    });

    return toPublicTask(task);
  } catch (err) {
    if (err?.code === "P2025") return null;
    throw err;
  }
}

export async function updateTaskAttachment(
  id,
  { attachmentPath, attachmentOriginalName, attachmentMimeType },
) {
  try {
    const task = await prisma.task.update({
      where: { id },
      data: {
        attachmentPath,
        attachmentOriginalName,
        attachmentMimeType,
      },
      select: taskSelect,
    });

    return toPublicTask(task);
  } catch (err) {
    if (err?.code === "P2025") return null;
    throw err;
  }
}

export async function deleteTaskById(id) {
  try {
    const task = await prisma.task.delete({
      where: { id },
      select: taskSelect,
    });

    return toPublicTask(task);
  } catch (err) {
    if (err?.code === "P2025") return null;
    throw err;
  }
}
