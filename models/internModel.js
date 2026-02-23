import { prisma } from "../lib/prisma.js";
import { createHttpError } from "../lib/http.js";

const internSelect = {
  id: true,
  name: true,
  email: true,
  profileImagePath: true,
  createdAt: true,
  updatedAt: true,
};

const internWithTasksSelect = {
  ...internSelect,
  tasks: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      title: true,
      status: true,
      attachmentPath: true,
    },
  },
};

function toPublicIntern(intern) {
  if (!intern) return null;
  return {
    id: intern.id,
    name: intern.name,
    email: intern.email,
    profileImagePath: intern.profileImagePath,
    createdAt: intern.createdAt,
    updatedAt: intern.updatedAt,
    tasks: Array.isArray(intern.tasks)
      ? intern.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          attachmentPath: task.attachmentPath,
        }))
      : undefined,
  };
}

function mapPrismaError(err) {
  if (err?.code === "P2002") {
    return createHttpError(409, "Intern email already exists");
  }

  return null;
}

export async function createIntern({ name, email }) {
  try {
    const intern = await prisma.intern.create({
      data: {
        name,
        email,
      },
      select: internSelect,
    });

    return toPublicIntern(intern);
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) throw mapped;
    throw err;
  }
}

export async function listInterns() {
  const interns = await prisma.intern.findMany({
    orderBy: { id: "asc" },
    select: internSelect,
  });

  return interns.map(toPublicIntern);
}

export async function getInternById(id, { includeTasks = false } = {}) {
  const intern = await prisma.intern.findUnique({
    where: { id },
    select: includeTasks ? internWithTasksSelect : internSelect,
  });

  return toPublicIntern(intern);
}

export async function updateInternProfileImagePath(id, profileImagePath) {
  try {
    const intern = await prisma.intern.update({
      where: { id },
      data: { profileImagePath },
      select: internSelect,
    });

    return toPublicIntern(intern);
  } catch (err) {
    if (err?.code === "P2025") return null;
    throw err;
  }
}

export async function deleteInternById(id) {
  try {
    const deleted = await prisma.intern.delete({
      where: { id },
      select: internWithTasksSelect,
    });

    return toPublicIntern(deleted);
  } catch (err) {
    if (err?.code === "P2025") return null;
    throw err;
  }
}
