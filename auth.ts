import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  //...your config
  plugins: [nextCookies()] // make sure this is the last plugin in the array
})