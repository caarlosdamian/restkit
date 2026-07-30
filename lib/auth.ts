import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

const mongodbUri = process.env.MONGODB_URI;

if (!mongodbUri) {
    if (process.env.NODE_ENV === "development" || process.env.BETTER_AUTH_CLI) {
        console.warn("MONGODB_URI is not defined. Better Auth might fail if database access is required.");
    } else {
        throw new Error("MONGODB_URI is not defined");
    }
}

const client = new MongoClient(mongodbUri || "mongodb://localhost:27017/unused");
const db = client.db();

export const auth = betterAuth({
    database: mongodbAdapter(db),
    emailAndPassword: {
        enabled: true
    },
    // better-auth rate-limits by IP in production builds (good — keep it).
    // The E2E suite runs a production build on localhost and fires many auth
    // calls in seconds from one IP, so its server sets this flag to opt out.
    // Never set it in a real deployment.
    ...(process.env.AUTH_DISABLE_RATE_LIMIT === "1"
        ? { rateLimit: { enabled: false } }
        : {}),
    user: {
        additionalFields: {
            role: {
                type: "string",
                defaultValue: "STAFF",
            },
            businessId: {
                type: "string",
            }
        }
    },
    // Required for the client-side to see these fields
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 1 week
        updateAge: 60 * 60 * 24 // 1 day
    }
});
