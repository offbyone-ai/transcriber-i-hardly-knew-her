import { describe, test, expect } from "bun:test"
import app from "../index"

describe("Routing", () => {
  describe("React App at Root", () => {
    test("GET / should return React app HTML", async () => {
      const res = await app.request("/")
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/html")
      
      const html = await res.text()
      expect(html).toContain("<title>Transcriber</title>")
      expect(html).toContain('<div id="root"></div>')
    })

    test("GET /dashboard should return React app HTML (SPA fallback)", async () => {
      const res = await app.request("/dashboard")
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/html")
      
      const html = await res.text()
      expect(html).toContain("<title>Transcriber</title>")
    })

    test("GET /subjects should return React app HTML (SPA fallback)", async () => {
      const res = await app.request("/subjects")
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/html")
    })

    test("GET /login should return React app HTML (SPA fallback)", async () => {
      const res = await app.request("/login")
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/html")
    })
  })

  describe("React App Assets", () => {
    test("CSS assets should have correct MIME type", async () => {
      const res = await app.request("/")
      const html = await res.text()
      
      // Extract CSS asset path from HTML
      const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/)
      if (cssMatch) {
        const cssPath = cssMatch[1]
        const cssRes = await app.request(cssPath)
        
        expect(cssRes.status).toBe(200)
        expect(cssRes.headers.get("content-type")).toContain("text/css")
      }
    })

    test("JavaScript assets should have correct MIME type", async () => {
      const res = await app.request("/")
      const html = await res.text()
      
      // Extract JS asset path from HTML
      const jsMatch = html.match(/src="(\/assets\/[^"]+\.js)"/)
      if (jsMatch) {
        const jsPath = jsMatch[1]
        const jsRes = await app.request(jsPath)
        
        expect(jsRes.status).toBe(200)
        const contentType = jsRes.headers.get("content-type")
        expect(
          contentType?.includes("text/javascript") || 
          contentType?.includes("application/javascript")
        ).toBe(true)
      }
    })

    test("SVG assets should be accessible", async () => {
      const res = await app.request("/vite.svg")
      // May or may not exist, but if it does, should be correct type
      if (res.status === 200) {
        const contentType = res.headers.get("content-type")
        expect(contentType).toContain("image/svg")
      }
    })
  })

  describe("CORS", () => {
    test("should have CORS headers on API routes", async () => {
      const res = await app.request("/api/hello", {
        headers: {
          "Origin": "http://localhost:5173"
        }
      })
      
      expect(res.headers.get("access-control-allow-origin")).toBeTruthy()
      expect(res.headers.get("access-control-allow-credentials")).toBe("true")
    })
  })
})
