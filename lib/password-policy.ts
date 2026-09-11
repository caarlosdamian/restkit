/**
 * The one place the password rule is written down.
 *
 * It has to be readable from three sides that cannot import each other: the
 * better-auth server config (which enforces it), the settings form where a
 * signed-in owner changes their password, and the public reset page. This
 * module is import-free on purpose — `lib/auth.ts` opens a MongoClient at
 * module scope, so a client component that imported the constant from there
 * would drag the database driver into the browser bundle.
 *
 * A form that guesses the number instead of reading it is how "mínimo 6
 * caracteres" ends up on a screen in front of a server that requires 8.
 */
export const MIN_PASSWORD_LENGTH = 8;
