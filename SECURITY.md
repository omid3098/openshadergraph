# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in OpenShaderGraph, please report it by emailing the maintainers or opening a private security advisory on GitHub.

**Please do not report security vulnerabilities through public GitHub issues.**

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Time

- We will acknowledge your report within 48 hours
- We will provide a detailed response within 7 days
- We will work on a fix and release a patch as soon as possible

## Security Considerations

### Input Validation

All user inputs are validated before processing:

1. **Node Values**: Validated against schema using Zod
2. **Graph JSON**: Validated structure and sanitized before loading
3. **Asset Uploads**: File type and size validation (when implemented)
4. **Shader Code**: Template-based compilation prevents injection attacks

### Data Sanitization

- User-provided node names are sanitized for shader compilation
- File paths are validated to prevent path traversal
- URLs are validated before fetching

### Known Limitations

1. **Client-Side Execution**: Most validation happens client-side
2. **Local Storage**: Graph data stored in browser local storage is not encrypted
3. **Asset Handling**: Asset validation is basic; full content validation pending

## Best Practices for Users

1. **Don't load untrusted graph JSON files** - They could contain malicious data
2. **Verify example graphs** - Only use official examples from this repository
3. **Keep dependencies updated** - Run `bun install` to get latest secure versions
4. **Review generated shaders** - Always review shader code before using in production

## Implemented Security Measures

### Input Sanitization

- ✅ Zod schema validation for all node definitions
- ✅ Sanitized identifiers for shader variable names
- ✅ URL validation for API calls
- ✅ File path validation to prevent traversal

### Content Security

- ✅ Template-based compilation (no eval or dynamic code execution)
- ✅ JSON schema validation
- ✅ Type safety with TypeScript strict mode

### Pending Security Improvements

- [ ] CSP headers for production deployment
- [ ] Rate limiting on API endpoints
- [ ] Enhanced asset content validation
- [ ] Encrypted local storage option
- [ ] Security headers (HSTS, X-Frame-Options, etc.)

## Security Checklist for Contributors

When contributing code, ensure:

- [ ] All user inputs are validated
- [ ] No use of `eval()`, `Function()`, or similar
- [ ] No dynamic code execution
- [ ] File operations use safe paths
- [ ] External data is sanitized
- [ ] Errors don't leak sensitive information
- [ ] Dependencies are from trusted sources

## Contact

For security concerns, contact:

- GitHub Security Advisories: https://github.com/omid3098/openshadergraph/security/advisories

---

Last Updated: September 30, 2025
