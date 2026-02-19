import { prisma } from "../lib/prisma.js";
import { createHttpError } from "../lib/http.js";
import { ROLE_NAMES } from "../lib/roles.js";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: {
    select: {
      name: true,
    },
  },
};

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  passwordHash: true,
  role: {
    select: {
      name: true,
    },
  },
};

const userIdentitySelect = {
  id: true,
  role: {
    select: {
      name: true,
    },
  },
};

function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.name,
  };
}

function toAuthUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role.name,
  };
}

function mapPrismaError(err) {
  if (err?.code === "P2002") {
    return createHttpError(409, "Email already exists");
  }

  if (err?.code === "P2025" || err?.code === "P2018") {
    return createHttpError(400, "Role does not exist");
  }

  return null;
}

export async function ensureDefaultRoles() {
  await prisma.role.upsert({
    where: { name: ROLE_NAMES.USER },
    update: {},
    create: { name: ROLE_NAMES.USER },
  });

  await prisma.role.upsert({
    where: { name: ROLE_NAMES.ADMIN },
    update: {},
    create: { name: ROLE_NAMES.ADMIN },
  });
}

export async function createUser({ name, email, passwordHash, roleName = ROLE_NAMES.USER }) {
  try {
    await ensureDefaultRoles();

    const createdUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: {
          connect: {
            name: roleName,
          },
        },
      },
      select: publicUserSelect,
    });

    return toPublicUser(createdUser);
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) throw mapped;
    throw err;
  }
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { id: "asc" },
    select: publicUserSelect,
  });
  return users.map(toPublicUser);
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });
  return toPublicUser(user);
}

export async function getUserByEmailForAuth(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: authUserSelect,
  });

  return toAuthUser(user);
}

export async function getUserIdentityById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userIdentitySelect,
  });

  if (!user) return null;
  return {
    id: user.id,
    role: user.role.name,
  };
}

export async function deleteUserById(id) {
  try {
    const user = await prisma.user.delete({
      where: { id },
      select: publicUserSelect,
    });
    return toPublicUser(user);
  } catch (err) {
    if (err?.code === "P2025") return null;
    throw err;
  }
}
