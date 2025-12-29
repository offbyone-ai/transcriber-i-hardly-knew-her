import { describe, test, expect } from "bun:test"
import app from "../index"

describe("API Endpoints", () => {
  describe("GET /api", () => {
    test("should return API server message", async () => {
      const res = await app.request("/api")
      expect(res.status).toBe(200)
      expect(await res.text()).toBe("Transcriber API Server")
    })
  })

  describe("GET /api/hello", () => {
    test("should return JSON response", async () => {
      const res = await app.request("/api/hello")
      expect(res.status).toBe(200)
      
      const data = await res.json() as Record<string, any>
      expect(data).toHaveProperty("message")
      expect(data).toHaveProperty("success")
      expect(data.success).toBe(true)
      expect(data.message).toBe("Hello from Transcriber API!")
    })

    test("should have correct content-type", async () => {
      const res = await app.request("/api/hello")
      expect(res.headers.get("content-type")).toContain("application/json")
    })
  })

  describe("GET /health", () => {
    test("should return health check status", async () => {
      const res = await app.request("/health")
      expect(res.status).toBe(200)
      
      const data = await res.json() as Record<string, any>
      expect(data).toHaveProperty("status")
      expect(data).toHaveProperty("timestamp")
      expect(data.status).toBe("ok")
    })

    test("should have valid timestamp", async () => {
      const res = await app.request("/health")
      const data = await res.json() as Record<string, any>
      
      const timestamp = new Date(data.timestamp)
      expect(timestamp.toString()).not.toBe("Invalid Date")
      
      // Timestamp should be recent (within last minute)
      const now = Date.now()
      const timestampMs = timestamp.getTime()
      expect(Math.abs(now - timestampMs)).toBeLessThan(60000)
    })
  })
})
