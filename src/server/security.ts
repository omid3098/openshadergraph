/**
 * Security middleware and utilities
 */

/**
 * Security headers to add to all responses in production
 */
export function getSecurityHeaders(isDevelopment = false): Record<string, string> {
  const headers: Record<string, string> = {
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    
    // XSS Protection (legacy but still useful)
    "X-XSS-Protection": "1; mode=block",
    
    // Prevent clickjacking
    "X-Frame-Options": "SAMEORIGIN",
  };

  // Only add strict security headers in production
  if (!isDevelopment) {
    // Content Security Policy
    headers["Content-Security-Policy"] = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed for dynamic compilation
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "worker-src 'self' blob:",
    ].join("; ");

    // HSTS - enforce HTTPS (only if deployed with HTTPS)
    // Uncomment when deployed with HTTPS:
    // headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }

  return headers;
}

/**
 * Add security headers to a Response
 */
export function addSecurityHeaders(response: Response, isDevelopment = false): Response {
  const headers = getSecurityHeaders(isDevelopment);
  const newHeaders = new Headers(response.headers);
  
  for (const [key, value] of Object.entries(headers)) {
    newHeaders.set(key, value);
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Sanitize a string for use as a shader identifier
 * Prevents injection attacks by ensuring only safe characters
 */
export function sanitizeIdentifier(input: string): string {
  // Remove all non-alphanumeric and underscore characters
  let sanitized = input.replace(/[^a-zA-Z0-9_]/g, "_");
  
  // Replace multiple underscores with single
  sanitized = sanitized.replace(/_+/g, "_");
  
  // Ensure it starts with a letter or underscore
  if (sanitized.length > 0 && /^[0-9]/.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }
  
  return sanitized || "unnamed";
}

/**
 * Validate file path to prevent directory traversal
 */
export function isValidPath(filePath: string): boolean {
  // Normalize path and check for traversal attempts
  const normalized = filePath.replace(/\\/g, "/");
  
  // Reject paths with ../ or absolute paths
  if (normalized.includes("../") || normalized.startsWith("/")) {
    return false;
  }
  
  // Reject paths with null bytes
  if (normalized.includes("\0")) {
    return false;
  }
  
  return true;
}

/**
 * Validate and sanitize JSON input
 */
export function validateJSON<T>(input: unknown): T | null {
  try {
    // Ensure input is a valid object
    if (typeof input !== "object" || input === null) {
      return null;
    }
    
    // Basic sanitization - remove functions and undefined
    const sanitized = JSON.parse(JSON.stringify(input));
    return sanitized as T;
  } catch {
    return null;
  }
}

/**
 * Rate limiting state (simple in-memory implementation)
 * In production, use Redis or similar
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple rate limiter
 * @param key - Unique identifier (e.g., IP address)
 * @param maxRequests - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if rate limit exceeded
 */
export function isRateLimited(
  key: string,
  maxRequests = 100,
  windowMs = 60000
): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || record.resetAt < now) {
    // Create new record
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  
  if (record.count >= maxRequests) {
    return true;
  }
  
  record.count++;
  return false;
}

/**
 * Clean up old rate limit records periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (record.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}, 60000); // Cleanup every minute
