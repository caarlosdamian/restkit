import { createAuthClient } from "better-auth/react";

// No baseURL: better-auth defaults to the page's own origin, which is always
// right here (the auth API lives on the same domain in dev, E2E, and prod).
// Passing NEXT_PUBLIC_APP_URL instead would inline it at BUILD time — a build
// made with one URL breaks auth when served from another (e.g. the E2E server
// on :3100, or a misconfigured env on Vercel).
export const authClient = createAuthClient();



