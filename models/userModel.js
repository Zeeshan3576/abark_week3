import { prisma } from "../lib/prisma.js";
import { createHttpError } from "../lib/http.js";

function mapPrismaError(err) {
  if (err?.code === "P2002") {
    return createHttpError(409, "Email already exists");
  }

  return null;
}

export async function createUser({ name, email, role }) {
  try {
    return await prisma.user.create({
      data: {
        name,
        email,
        ...(role ? { role } : {}),
      },
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) throw mapped;
    throw err;
  }
}

export async function listUsers() {
  return await prisma.user.findMany({ orderBy: { id: "asc" } });
}

export async function getUserById(id) {
  return await prisma.user.findUnique({ where: { id } });
}

export async function deleteUserById(id) {
  try {
    return await prisma.user.delete({ where: { id } });
  } catch (err) {
    if (err?.code === "P2025") return null;
    throw err;
  }
}

