# Contributing to NexusAgent

Thank you for your interest in contributing to NexusAgent! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting Pull Requests](#submitting-pull-requests)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Skill Development](#skill-development)
- [Security Vulnerabilities](#security-vulnerabilities)

## Code of Conduct

- Be respectful and inclusive in all interactions
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/nexus-agent.git`
3. Navigate to the project: `cd nexus-agent`
4. Install dependencies: `npm install` or `bun install`
5. Copy environment variables: `cp .env.example .env`
6. Push database schema: `npx prisma db push`
7. Start development server: `npm run dev`

## Development Setup

### Prerequisites

- Node.js 18+ or Bun 1.0+
- npm, yarn, or bun
- Git

### Project Structure

```
nexus-agent/
├── src/
│   ├── app/              # Next.js app routes
│   │   ├── api/          # API endpoints
│   │   │   └── agent/    # Agent-specific APIs
│   │   ├── layout.tsx    # Root layout
│   │   ├── page.tsx      # Main page (demo + docs)
│   │   └── globals.css   # Global styles
│   ├── components/
│   │   ├── agent/        # Agent UI components
│   │   └── ui/           # shadcn/ui components
│   └── lib/
│       ├── agent/        # Core agent engine
│       │   ├── types.ts  # Type definitions
│       │   ├── memory.ts # Memory system
│       │   ├── skills.ts # Skill framework
│       │   └── index.ts  # Agent runtime
│       ├── security/     # Security layer
│       │   └── manager.ts
│       └── utils.ts      # Utilities
├── prisma/
│   └── schema.prisma     # Database schema
├── docs/                 # Documentation
├── examples/             # Example skills
├── .github/              # GitHub config
│   └── workflows/        # CI/CD workflows
└── tests/                # Test files
```

## Making Changes

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes with clear, well-commented code
3. Follow existing code style and patterns
4. Write tests for new functionality
5. Update documentation as needed
6. Commit with descriptive messages: `git commit -m "feat: add new feature"`

### Commit Message Convention

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `security:` Security-related changes

## Submitting Pull Requests

1. Ensure all tests pass: `npm test`
2. Run linting: `npm run lint`
3. Push to your fork: `git push origin feature/your-feature-name`
4. Open a Pull Request against the `main` branch
5. Provide a clear description of changes
6. Respond to code review feedback

## Reporting Bugs

Use the GitHub issue tracker with the following template:

```markdown
**Bug Description**
A clear description of the bug.

**Steps to Reproduce**
1. Step one
2. Step two
3. ...

**Expected Behavior**
What you expected to happen.

**Actual Behavior**
What actually happened.

**Environment**
- OS: [e.g., macOS 14.0]
- Node.js version: [e.g., 20.0.0]
- Browser: [e.g., Chrome 120]
```

## Suggesting Features

We welcome feature suggestions! Please open an issue with:

- A clear description of the proposed feature
- The motivation/use case
- Any potential implementation ideas

## Skill Development

To create a new skill for NexusAgent:

1. Create a new file in `examples/skills/`
2. Define your skill following the `SkillDefinition` interface
3. Implement the handler function
4. Add tests for your skill
5. Submit a PR with the `[skill]` tag

## Security Vulnerabilities

If you discover a security vulnerability, please report it privately by emailing security@nexusagent.dev. Do NOT open a public issue.

We offer bounties for responsibly disclosed security vulnerabilities:
- Critical: $500-$2000
- High: $200-$500
- Medium: $50-$200
- Low: Swag and recognition

Thank you for contributing to NexusAgent!
