# CloudPilot

CloudPilot is an infrastructure control plane I'm building to explore how AI agents can make infrastructure changes without blindly executing whatever an LLM suggests.

The idea is simple: generating a script is the easy part. Deciding whether it should run, controlling what it can change, and checking whether the change actually worked are the harder problems.

CloudPilot uses Groq to turn natural-language requests into structured proposals, MCP to expose infrastructure operations, and ArmorIQ for authorized tool invocation. The control plane evaluates proposed changes against policy and resource scope, executes permitted operations, and verifies the resulting infrastructure state.

The current implementation is built around Cloudflare Workers. It supports infrastructure inspection and a policy-gated update workflow for a server-configured disposable Worker. The update path includes explicit user confirmation, desired-versus-observed state comparison, deployed-script drift detection, and post-deployment verification.

The goal is to make infrastructure operations easier to express without making them less controlled.

## How it works

`Natural-language request → Proposal → Policy evaluation → Authorized execution → Verification`

Groq proposes an action; it does not authorize the infrastructure change. The proposed operation goes through the existing authorization and policy checks before execution. Afterward, CloudPilot checks the observed state against the desired state rather than treating a successful deployment request as proof that everything worked.

The current update workflow is deliberately scoped to a disposable Worker while the control plane evolves.

## What's implemented

- Infrastructure inspection through MCP.
- Natural-language proposal generation using Groq.
- ArmorIQ-integrated tool invocation.
- Policy, risk, readiness, approval, and resource-scope checks in the control-plane workflow.
- Controlled Cloudflare Worker updates.
- Desired-versus-observed state comparison and deployed-script drift detection.
- Post-deployment verification and automated tests for execution and failure paths.

## Built with

- **TypeScript** — control-plane logic and infrastructure tooling
- **Cloudflare Workers and D1** — control-plane runtime and persistence
- **Groq** — natural-language proposal generation
- **MCP** — infrastructure tool interface
- **ArmorIQ** — authorized agent tool invocation
- **Vitest** — automated testing

## Status

CloudPilot is a work in progress. The core request-to-execution-to-verification loop has been exercised against a live Cloudflare Worker.

The longer-term goal is to explore how far a policy-governed, verification-first approach can take AI-assisted infrastructure operations.