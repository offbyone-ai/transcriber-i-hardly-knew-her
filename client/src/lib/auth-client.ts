import { createAuthClient } from "better-auth/react"
import { magicLinkClient } from "better-auth/client/plugins"

const baseURL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000"

export const authClient = createAuthClient({
  baseURL,
  plugins: [magicLinkClient()],
})

export const { signIn, signUp, signOut, useSession } = authClient
