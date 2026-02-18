import { createHttpError, readJsonBody, sendJson } from "../lib/http.js";
import {
  createUser as createUserRecord,
  deleteUserById,
  getUserById,
  listUsers,
} from "../models/userModel.js";

function toTrimmedString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function createUser(req, res) {
  const body = await readJsonBody(req);

  const name = toTrimmedString(body.name);
  if (!name) throw createHttpError(400, "Name is required");

  const email = toTrimmedString(body.email);
  if (!email) throw createHttpError(400, "Email is required");
  if (!isValidEmail(email)) throw createHttpError(400, "Email is invalid");

  let role;
  if (body.role !== undefined) {
    role = toTrimmedString(body.role);
    if (!role) throw createHttpError(400, "Role must be a non-empty string");
  }

  const user = await createUserRecord({ name, email, role });
  sendJson(res, 201, user);
}

export async function getUsers(req, res) {
  const users = await listUsers();
  sendJson(res, 200, users);
}

export async function getUser(req, res, id) {
  const user = await getUserById(id);
  if (!user) throw createHttpError(404, "User not found");
  sendJson(res, 200, user);
}

export async function deleteUser(req, res, id) {
  const deletedUser = await deleteUserById(id);
  if (!deletedUser) throw createHttpError(404, "User not found");
  sendJson(res, 200, deletedUser);
}

