import { createAuthClient } from "better-auth/react"
import { magicLinkClient } from "better-auth/client/plugins"
import { passkeyClient } from "@better-auth/passkey/client"


const baseURL = import.meta.env.VITE_SERVER_URL || "http://localhost:3847"

export const authClient = createAuthClient({
  baseURL,
  plugins: [passkeyClient(), magicLinkClient()],
})

export const { signIn, signUp, signOut, useSession } = authClient
