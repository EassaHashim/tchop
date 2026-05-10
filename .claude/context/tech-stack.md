# tchop.io — Tech Stack

Reference for sales, security, and copywriting contexts. Use when handling IT/procurement objections, writing technical documentation, or making infrastructure claims.

Source: internal tech stack document (last updated 2025).

---

## Overview

tchop is built on modern, scalable languages and frameworks. The platform is 100% cloud-based — no self-operated servers. All servers are located in Germany, meaning all data stays within the EU. Clients can choose between AWS and Hetzner hosting. On premise is technically also possible.

**ISO 27001 certified** — information security management system audited and certified by TÜV Süd in October 2025, based on the latest norm.

---

## Languages and Frameworks

### Backend + Web
- **TypeScript** — primary language across backend and web
- **React** — frontend framework for web app
- **Node.js** — backend runtime
- **Docker** — containerization
- **NGINX** — web server / reverse proxy

### API
- **REST** — primary API protocol
- **GraphQL** — also supported for API access
- **OpenAPI / Swagger** — API documentation and client contract

### Mobile Apps
- **Swift 5** (iOS) — native, officially supported by Apple
- **Kotlin** (Android, JetBrains) — native, officially supported by Google

Native languages are used for both platforms to guarantee best-in-class UX, performance, and access to the latest OS features and security standards.

---

## Architecture

**Headless / decoupled.** The backend is API-first. Web frontends and mobile apps are fully decoupled from the backend — both are treated as clients of the API. This architecture:
- Keeps clients flexible and independently deployable
- Increases security through service isolation and API protection
- Allows mobile and web surfaces to evolve independently

---

## Infrastructure

- **100% cloud-based** — no self-hosted servers
- **All servers in Germany** — full EU data residency, GDPR-compliant by infrastructure design
- **EU-sovereign hosting option** available for enterprise clients with strict data residency requirements
- DevOps team manages infrastructure using modern CI/CD practices

---

## Development Methods

### CI/CD (Continuous Integration / Continuous Delivery)
Software is built and deployed continuously. Pipelines (Travis CI) run all unit and integration tests automatically on every change.

### TDD (Test-driven Development)
Tests are written before code. Unit tests from TDD are an integral part of the CI/CD pipeline. This reduces bugs and enforces quality at the source.

### Agile / Kanban
- Sprint-based development (10–30 project days per sprint)
- Each sprint includes planning, review, and retrospective
- Kanban used as the workflow method

### Pair Programming
Two developers work together on each story or task. Results in fewer bugs, higher code quality, reduced rework, and shared knowledge across the team. Supported by mentoring, training, and internal code reviews.

---

## Tools

| Tool | Purpose |
|------|---------|
| **GitHub** | Source control for mobile apps — version control, issues, code reviews, deployments (Git-Flow) |
| **GitLab** | Source control for backend and web frontends — version control, issues, code reviews, deployments |
| **Bitrise** | Automated build system for native mobile apps — manages, updates, and deploys a large number of white-label app builds |
| **Fastlane** | App release pipeline — code compilation, code signing, build configuration, App Store submission. Configured via JSON (managed through a custom Electron app) |

---

## Security and Compliance

- **ISO 27001 certified** (TÜV Süd, October 2025)
- **GDPR-compliant** — all data stored on servers in Germany
- **EU-sovereign hosting** available on request
- Security architecture: service isolation + API protection
- SSO support for enterprise authentication
- Security documentation available for IT/procurement review processes

---

## Key Claims for Sales / Copywriting

Use these when handling technical objections or writing security-related copy:

- "ISO 27001 certified — audited by TÜV Süd"
- "All data stored on servers in Germany"
- "EU-sovereign hosting available with Hetzner"
- "Native iOS (Swift) and Android (Kotlin) apps — real native experience, not a wrapper"
- "GDPR-compliant by infrastructure design"
- "DSA-compliant by design"
- "Security documentation available for procurement"
