export const ROLE_NAMES = Object.freeze({
  USER: "USER",
  ADMIN: "ADMIN",
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLE_NAMES));

export function isValidRoleName(value) {
  return ROLE_VALUES.includes(value);
}
