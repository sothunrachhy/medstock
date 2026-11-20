// The backend requires at least 8 characters for every new password (login, admin-created users,
// password change). It is a fixed rule there, so the forms use the same number as a hint.
const POLICY = Object.freeze({ minPasswordLength: 8 });

export default function usePasswordPolicy() {
  return POLICY;
}
