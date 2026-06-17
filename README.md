# n8n Nodes for Kipps.AI

This package provides production-ready custom n8n nodes for integrating with the Kipps.AI platform.

It supports:

* **Chatbot Agents** — conversational AI workflows
* **Voice Agents** — outbound/inbound AI voice calls
* **WhatsApp Agents** — template messaging via WhatsApp Business

---

# Features

## Supported Nodes

### 1. Kipps.AI Chatbot

Send messages to Kipps chatbot agents and receive contextual responses.

### 2. Kipps.AI Voice Agent

Initiate voice calls using Kipps voice agents.

### 3. Kipps.AI WhatsApp Agent

Send approved WhatsApp templates through agent-linked WhatsApp integrations.

### 4. Dynamic Agent Discovery

Agents are automatically loaded from the authenticated organization.

No manual UUID lookup is required.

Agents are loaded using:

```http
GET /kipps/agents/
```

and automatically filtered into:

* Chatbots
* Voice Agents
* WhatsApp Agents

---

# Installation

---

## Docker (Recommended for Local Testing)

### Step 1: Clone Repository

```bash
git clone https://github.com/KIPPS-AI/n8n-nodes-kipps.git
cd n8n-nodes-kipps
```

---

### Step 2: Install Dependencies

```bash
npm install
```

---

### Step 3: Build Node

```bash
npm run build
```

---

### Step 4: Verify Build Output

```bash
ls dist/nodes/KippsAi/
```

Expected:

```bash
KippsAi.node.js
kipps-light.png
kipps-dark.png
```

---

### Step 5: Run n8n with Docker

## Windows PowerShell

```powershell
docker run -it --rm -p 5678:5678 `
  -v "${PWD}:/home/node/.n8n/custom" `
  -e N8N_CUSTOM_EXTENSIONS_MODE=paths `
  -e N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom `
  n8nio/n8n
```

---

## Windows CMD

```cmd
docker run -it --rm -p 5678:5678 -v "%cd%:/home/node/.n8n/custom" -e N8N_CUSTOM_EXTENSIONS_MODE=paths -e N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom n8nio/n8n
```

---

## Linux/macOS

```bash
docker run -it --rm -p 5678:5678 \
  -v "$(pwd):/home/node/.n8n/custom" \
  -e N8N_CUSTOM_EXTENSIONS_MODE=paths \
  -e N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom \
  n8nio/n8n
```

---

### Step 6: Open n8n

```txt
http://localhost:5678
```

---

# Production Installation (npm)

```bash
npm install n8n-nodes-kipps
```

Restart n8n after installation.

---

# Docker Compose Mount

```yaml
volumes:
  - ./n8n-nodes-kipps:/home/node/.n8n/custom
```

---

# Authentication Setup

Kipps.AI nodes use API Key authentication.

## Credential Fields

### Required

* API Key

### Optional

* Base URL

Production:

```txt
https://backend.kipps.ai
```

Local Development:

```txt
http://host.docker.internal:8000
```

If Base URL is left empty, the node automatically uses:

```txt
https://backend.kipps.ai
```

---

# Credential Verification

Credential validation uses:

```http
GET /kipps/agents/
```

A successful response confirms:

* API key is valid
* Organization access is available
* Agent discovery is working

---

# Node Types and Parameters

---

# Kipps.AI Chatbot

### Parameters

* **Agent Name or ID** — Automatically loaded from your organization
* **Message** — User input
* **Session ID** — Optional conversation continuity

### APIs Used

```http
POST /v2/kipps/conversation/
POST /v2/kipps/reply/
```

---

# Kipps.AI Voice Agent

### Parameters

* **Voicebot Name or ID** — Automatically loaded from your organization
* **Phone Number**
* **Room Name**

### API Used

```http
POST /speech/phone-call/
```

---

# Kipps.AI WhatsApp Agent

### Parameters

* **WhatsApp Agent Name or ID** — Automatically loaded from your organization
* **Recipient Number**
* **Template Name**
* **Template Parameters**

---

# WhatsApp Template Architecture

## Template Fetch Endpoint

```http
GET /integrations/get-whatsapp-templates/
```

### Requirements

* Authenticated organization
* Valid API key

---

## Send Template Endpoint

```http
POST /integrations/whatsapp-agent/send-template/
```

### Required Payload

```json
{
  "to": "+1234567890",
  "template_name": "hello_world",
  "parameters": {}
}
```

---

# Local Development Notes

If testing against a local Django backend:

### Base URL

```txt
http://host.docker.internal:8000
```

---

### Django Run Command

```bash
python manage.py runserver 0.0.0.0:8000
```

---

### Local Authentication

Use a valid local API Key and configure:

```txt
Base URL = http://host.docker.internal:8000
```

---

# Common Issues

---

## Node Not Appearing

### Causes

* Build failure
* Wrong mount path
* Missing package.json configuration

### Fix

```bash
npm run build
```

---

## Broken Icon

### Causes

* Missing icon files
* Wrong filenames

### Required

```txt
kipps-light.png
kipps-dark.png
```

---

## Agent Dropdown Not Loading

### Causes

* Invalid API key
* Wrong backend URL
* Missing organization access
* Stale Docker build

### Fix

* Verify credentials
* Verify API key permissions
* Rebuild node
* Restart n8n container

---

## Template Dropdown Not Loading

### Causes

* Invalid WhatsApp agent
* Missing approved templates
* Wrong backend URL
* Stale Docker build

### Fix

* Verify credentials
* Verify WhatsApp agent configuration
* Rebuild
* Restart container

---

## Docker Errors

### Port already allocated

```bash
docker ps
docker stop <container_id>
```

---

### Permission denied scanning host

Mount the correct project directory only.

---

# Build Commands

```bash
npm install
npm run build
```

---

# Publishing to npm

### First time setup

```bash
# Login to npm
npm login

# Generate a Granular Access Token on npmjs.com:
# Avatar → Access Tokens → Generate New Token → Granular Access Token
# Permissions: Read and write | Packages: All packages

# Set the token
npm set //registry.npmjs.org/:_authToken YOUR_TOKEN_HERE
```

### Publish manually

```bash
npm run build
npm publish --access public
```

### Version bumping rules

Every publish needs a new version in `package.json`:

| Change type | Example           | When to use               |
| ----------- | ----------------- | ------------------------- |
| Patch       | `1.0.0` → `1.0.1` | Bug fix, lint fix         |
| Minor       | `1.0.0` → `1.1.0` | New agent type, new field |
| Major       | `1.0.0` → `2.0.0` | Breaking change           |

---

## GitHub Actions — Automated Publish

After the initial setup, **never publish manually**. All publishes go through GitHub Actions for npm provenance (required for n8n verification).

### How it works

```
You push code changes
      ↓
Update version in package.json
      ↓
git push to master
      ↓
GitHub → Releases → Create new release
Tag: v1.0.2 (must match package.json version,always new version)
      ↓
GitHub Actions automatically runs:
  - npm install
  - npm run build
  - npm publish --provenance
      ↓
npm email confirmation received ✅
```

### Setup (one time only)

**1. Add NPM_TOKEN to GitHub secrets:**

- Repo → Settings → Secrets and variables → Actions
- New repository secret
    - Name: `NPM_TOKEN`
    - Value: your npmjs.com Granular Access Token

**2. Workflow file is already in repo:**
`.github/workflows/publish.yml`

### Creating a release

1. Update `version` in `package.json` (e.g. `1.0.2`)
2. Commit and push
3. GitHub repo → **Releases** → **Create a new release**
4. Tag: `v1.0.2` (create new tag)
5. Title: `v1.0.2`
6. Click **Publish release**
7. Watch **Actions** tab — should go green in ~2 minutes

---

# Recommended Testing Flow

## Before Production

Verify:

* Credential authentication
* Chatbot dropdown
* Voicebot dropdown
* WhatsApp dropdown
* Template dropdown
* Template parameter mapper
* Chatbot execution
* Voice call execution
* WhatsApp template execution
* Docker loading
* Icon rendering

---

# Support

## Kipps Platform

```txt
https://app.kipps.ai
```

## Backend API

```txt
https://backend.kipps.ai
```

---

# Final Notes

This package is designed for:

* Workflow automation
* Lead generation
* WhatsApp campaigns
* AI voice automation
* Enterprise chatbot integrations

For production deployment, always validate:

* API credentials
* Organization permissions
* WhatsApp integrations
* Template approval status

---

# License

MIT
