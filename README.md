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

## Windows PowerShell:

```powershell
docker run -it --rm -p 5678:5678 `
  -v "${PWD}:/home/node/.n8n/custom" `
  -e N8N_CUSTOM_EXTENSIONS_MODE=paths `
  -e N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom `
  n8nio/n8n
```

---

## Windows CMD:

```cmd
docker run -it --rm -p 5678:5678 -v "%cd%:/home/node/.n8n/custom" -e N8N_CUSTOM_EXTENSIONS_MODE=paths -e N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom n8nio/n8n
```

---

## Linux/macOS:

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

Kipps.AI nodes require valid API authentication.

## Credential Fields

### Required:

* API Key / Bearer Token
* Allowed HTTP Request Domains

### Recommended Domain:

```txt
backend.kipps.ai
```

For local backend testing:

```txt
host.docker.internal
```

---

# Node Types and Parameters

---

# Kipps.AI Chatbot

### Parameters:

* **Agent ID** — Chatbot UUID
* **Message** — User input
* **Session ID** — Optional conversation continuity

---

# Kipps.AI Voice Agent

### Parameters:

* **Voicebot ID**
* **Phone Number**
* **Room Name**

---

# Kipps.AI WhatsApp Agent

### Parameters:

* **WhatsApp Agent UUID**
* **Recipient Number**
* **Template Name**
* **Template Parameters**

---

# WhatsApp Template Architecture

## Template Fetch Endpoint:

```http
GET /integrations/get-whatsapp-templates/
```

### Requirements:

* Authenticated organization
* API key / bearer token

---

## Send Template Endpoint:

```http
POST /integrations/whatsapp-agent/send-template/
```

### Required Payload:

```json
{
  "agent_uuid": "...",
  "to": "+1234567890",
  "template_name": "hello_world",
  "parameters": {}
}
```

---

# Local Development Notes

If testing against local Django backend:

### Base URL:

```txt
http://host.docker.internal:8000
```

---

### Django Run Command:

```bash
python manage.py runserver 0.0.0.0:8000
```

---

### Local Auth Options:

#### Option A:

Use valid local bearer token

#### Option B:

Temporarily disable:

```py
permission_classes = []
```

---

# Common Issues

---

## Node Not Appearing

### Causes:

* Build failure
* Wrong mount path
* Missing package.json config

### Fix:

```bash
npm run build
```

---

## Broken Icon

### Causes:

* Missing icon files
* Wrong filenames

### Required:

```txt
kipps-light.png
kipps-dark.png
```

---

## Template Dropdown Not Loading

### Causes:

* Invalid API key
* Wrong backend URL
* Missing auth
* Stale Docker build

### Fix:

* Verify credentials
* Rebuild
* Restart container

---

## Docker Errors

### Port already allocated:

```bash
docker ps
docker stop <container_id>
```

---

### Permission denied scanning host:

Mount correct project directory only.

---

# Build Commands

```bash
npm install
npm run build
```

---

# Publish to npm

```bash
npm login
npm publish
```

---

# Recommended Testing Flow

## Before production:

### Verify:

* Chatbot node
* Voice node
* WhatsApp node
* Template dropdown
* Template parameter mapper
* Credential auth
* Docker loading
* Icon rendering

---

# Support

## Kipps Platform:

```txt
https://app.kipps.ai
```

## Backend API:

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
