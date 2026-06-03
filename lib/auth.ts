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
