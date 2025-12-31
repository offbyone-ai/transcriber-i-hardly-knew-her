import { describe, test, expect } from "bun:test"
import app from "../index"

describe("Routing", () => {
  describe("Landing Page", () => {
    test("GET / should return landing page HTML", async () => {
      const res = await app.request("/")
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/html")
      
      const html = await res.text()
      expect(html).toContain("<title>Transcriber, I Hardly Knew Her</title>")
      expect(html).toContain("100% Local")
      expect(html).toContain("Your audio doesn't")
    })

    test("GET /landing/styles.css should return CSS", async () => {
      const res = await app.request("/landing/styles.css")
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/css")
      
      const css = await res.text()
      expect(css).toContain("body")
      expect(css).toContain("font-family")
    })

    test("landing page should have links to /app", async () => {
      const res = await app.request("/")
      const html = await res.text()
      
      expect(html).toContain('href="/app"')
      expect(html).toContain("Start Transcribing")
    })
  })

  describe("React App Routes", () => {
    test("GET /app should return React app HTML", async () => {
      const res = await app.request("/app")
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/html")
      
      const html = await res.text()
      expect(html).toContain("<title>Transcriber, I Hardly Knew Her</title>")
      expect(html).toContain('<div id="root"></div>')
    })

    test("GET /app/ should return React app HTML", async () => {
      const res = await app.request("/app/")
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/html")
    })

    test("GET /app/dashboard should return React app HTML (SPA fallback)", async () => {
      const res = await app.request("/app/dashboard")
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/html")
      
      const html = await res.text()
      expect(html).toContain("<title>Transcriber, I Hardly Knew Her</title>")
    })

    test("GET /app/subjects should return React app HTML (SPA fallback)", async () => {
      const res = await app.request("/app/subjects")
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/html")
    })

    test("GET /app/login should return React app HTML (SPA fallback)", async () => {
      const res = await app.request("/app/login")
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/html")
    })
  })

  describe("React App Assets", () => {
    test("CSS assets should have correct MIME type", async () => {
      const res = await app.request("/app")
      const html = await res.text()
      
      // Extract CSS asset path from HTML
      const cssMatch = html.match(/href="(\/app\/assets\/[^"]+\.css)"/)
      if (cssMatch) {
        const cssPath = cssMatch[1]
        const cssRes = await app.request(cssPath)
        
        expect(cssRes.status).toBe(200)
        expect(cssRes.headers.get("content-type")).toContain("text/css")
        
        // Verify it's actually CSS, not HTML
        const cssContent = await cssRes.text()
        expect(cssContent).not.toContain("<!DOCTYPE html")
        expect(cssContent).not.toContain("<html")
      }
    })

    test("JavaScript assets should have correct MIME type", async () => {
      const res = await app.request("/app")
      const html = await res.text()
      
      // Extract JS asset path from HTML
      const jsMatch = html.match(/src="(\/app\/assets\/[^"]+\.js)"/)
      if (jsMatch) {
        const jsPath = jsMatch[1]
        const jsRes = await app.request(jsPath)
        
        expect(jsRes.status).toBe(200)
        const contentType = jsRes.headers.get("content-type")
        expect(
          contentType?.includes("text/javascript") || 
          contentType?.includes("application/javascript")
        ).toBe(true)
        
        // Verify it's actually JS, not HTML
        const jsContent = await jsRes.text()
        expect(jsContent).not.toContain("<!DOCTYPE html")
        expect(jsContent).not.toContain("<html")
      }
    })

    test("SVG assets should be accessible", async () => {
      const res = await app.request("/app/vite.svg")
      // May or may not exist, but if it does, should be correct type
      if (res.status === 200) {
        const contentType = res.headers.get("content-type")
        expect(contentType).toContain("image/svg")
      }
    })
    
    test("GET /app/assets/* paths should serve CSS files, not HTML", async () => {
      // Test with a known CSS file from the build
      const res = await app.request("/app/assets/index-DoJK-WUz.css")
      
      if (res.status === 200) {
        expect(res.headers.get("content-type")).toContain("text/css")
        
        const content = await res.text()
        // Should be CSS content
        expect(content).not.toContain("<!DOCTYPE")
        expect(content).not.toContain("<html")
        expect(content).not.toContain("<div id=\"root\">")
      }
    })
    
    test("GET /app/assets/* paths should serve JS files, not HTML", async () => {
      // Test with a known JS file from the build
      const res = await app.request("/app/assets/index-DFzvB91U.js")
      
      if (res.status === 200) {
        const contentType = res.headers.get("content-type")
        expect(
          contentType?.includes("javascript") || 
          contentType?.includes("application/javascript")
        ).toBe(true)
        
        const content = await res.text()
        // Should be JS content
        expect(content).not.toContain("<!DOCTYPE")
        expect(content).not.toContain("<html")
        expect(content).not.toContain("<div id=\"root\">")
      }
    })
  })

  describe("Route Separation", () => {
    test("/ should serve landing page, not React app", async () => {
      const res = await app.request("/")
      const html = await res.text()
      
      // Landing page specific content
      expect(html).toContain("Your audio doesn't")
      
      // Should NOT contain React app root
      expect(html).not.toContain('<div id="root"></div>')
    })

    test("/app should serve React app, not landing page", async () => {
      const res = await app.request("/app")
      const html = await res.text()
      
      // React app specific content
      expect(html).toContain('<div id="root"></div>')
      
      // Should NOT contain landing page specific content
      expect(html).not.toContain("Your audio doesn't")
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
