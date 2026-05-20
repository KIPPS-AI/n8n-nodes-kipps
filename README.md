# n8n-nodes-kipps

Official Kipps.AI community node for n8n — **Chatbot**, **Voice Agent**, and **WhatsApp** in one single node.

[![npm version](https://img.shields.io/npm/v/n8n-nodes-kipps.svg)](https://www.npmjs.com/package/n8n-nodes-kipps)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Table of Contents

- [For End Users — How to Install](#for-end-users--how-to-install)
- [For Developers — How to Add a New Agent Type](#for-developers--how-to-add-a-new-agent-type)
  - [Project Structure](#project-structure)
  - [Step 1 — Clone & Setup](#step-1--clone--setup)
  - [Step 2 — Understand the Node Architecture](#step-2--understand-the-node-architecture)
  - [Step 3 — Add a New Agent Type](#step-3--add-a-new-agent-type)
  - [Step 4 — Required Fields for Every Node Property](#step-4--required-fields-for-every-node-property)
  - [Step 5 — Add Execute Logic](#step-5--add-execute-logic)
  - [Step 6 — Test Locally with Docker](#step-6--test-locally-with-docker)
  - [Step 7 — Publish a New Version](#step-7--publish-a-new-version)
- [Credentials](#credentials)
- [Common Errors & Fixes](#common-errors--fixes)

---

## For End Users — How to Install

1. Open your n8n instance
2. Go to **Settings** → **Community Nodes**
3. Click **"Install a community node"**
4. Enter: `n8n-nodes-kipps`
5. Click **Install**
6. Search **"Kipps"** in the node panel — done ✅

> **Note:** Community nodes only work on self-hosted n8n. n8n Cloud requires admin to enable them.

---

## For Developers — How to Add a New Agent Type

This guide explains everything from scratch — how the node is built, what every field means, and how to add a new agent type (e.g. a new Kipps.AI API).

### Project Structure

```
n8n-nodes-kipps/
├── .github/
│   └── workflows/
│       └── publish.yml          ← GitHub Actions auto-publish on Release
├── credentials/
│   └── KippsAiApi.credentials.ts  ← API Key + Base URL credential
├── nodes/
│   └── KippsAi/
│       ├── KippsAi.node.ts      ← Main node (all agent types here)
│       ├── kipps-light.svg      ← Icon for light mode
│       └── kipps-dark.svg       ← Icon for dark mode
├── gulpfile.js                  ← Copies SVG icons to dist/
├── package.json                 ← npm package config
└── tsconfig.json                ← TypeScript config
```

---

### Step 1 — Clone & Setup

```bash
git clone https://github.com/KIPPS-AI/n8n-nodes-kipps.git
cd n8n-nodes-kipps
npm install
```

Make sure you have Node.js >= 20.15 installed.

---

### Step 2 — Understand the Node Architecture

All agent types live in **one single file**: `nodes/KippsAi/KippsAi.node.ts`

The node has 3 main sections:

```
KippsAi.node.ts
│
├── methods {}              ← loadOptions & resourceMapping (for dynamic dropdowns)
│   ├── loadOptions         ← fetches data from API to populate dropdowns
│   └── resourceMapping     ← generates dynamic form fields (e.g. WhatsApp params)
│
├── description {}          ← defines what the node looks like in n8n UI
│   ├── displayName         ← node name shown in n8n
│   ├── properties []       ← all input fields (Agent Type dropdown + per-agent fields)
│   └── credentials []      ← which credential this node uses
│
└── execute()               ← actual logic that runs when node executes
    ├── if agentType === 'chatbot' → call chatbot API
    ├── if agentType === 'voiceAgent' → call voice API
    └── if agentType === 'whatsapp' → call whatsapp API
```

The **"Agent Type"** dropdown at the top controls which fields are shown using `displayOptions`.

---

### Step 3 — Add a New Agent Type

Example: Adding a new **"SMS Agent"** type.

#### 3a. Add option to the Agent Type dropdown

Find the `agentType` property in `description.properties` and add your new option:

```typescript
{
  displayName: 'Agent Type',
  name: 'agentType',
  type: 'options',
  noDataExpression: true,
  options: [
    { name: 'Chatbot',     value: 'chatbot',     description: '...' },
    { name: 'Voice Agent', value: 'voiceAgent',  description: '...' },
    { name: 'WhatsApp',    value: 'whatsapp',    description: '...' },
    // ✅ ADD YOUR NEW TYPE HERE:
    { name: 'SMS Agent',   value: 'smsAgent',    description: 'Send SMS via Kipps.AI' },
  ],
  default: 'chatbot',
},
```

#### 3b. Add input fields for your new agent type

After the existing fields, add your new fields with `displayOptions` so they only show when your agent type is selected:

```typescript
// ── SMS AGENT fields ──────────────────────────────────────────────
{
  displayName: 'Phone Number',
  name: 'smsPhoneNumber',
  type: 'string',
  default: '',
  placeholder: '+911234567890',
  description: 'Recipient phone number in E.164 format',
  required: true,
  displayOptions: { show: { agentType: ['smsAgent'] } },  // ← IMPORTANT
},
{
  displayName: 'Message',
  name: 'smsMessage',
  type: 'string',
  default: '',
  placeholder: 'Your SMS message here',
  description: 'The SMS message to send',
  required: true,
  displayOptions: { show: { agentType: ['smsAgent'] } },  // ← IMPORTANT
},
```

> **`displayOptions`** is how you show/hide fields based on the selected agent type. Always include it or the field will show for ALL agent types.

#### 3c. Add execute logic

Inside the `execute()` function, add a new `else if` block:

```typescript
// ── SMS AGENT ──────────────────────────────────────────────────
else if (agentType === 'smsAgent') {
  const phoneNumber = this.getNodeParameter('smsPhoneNumber', i, '') as string;
  const message = this.getNodeParameter('smsMessage', i, '') as string;

  const response = await this.helpers.httpRequestWithAuthentication.call(
    this, 'kippsAiApi',
    {
      method: 'POST' as IHttpRequestMethods,
      url: `${baseUrl}/sms/send/`,       // ← your API endpoint
      body: {
        to_phone_number: phoneNumber,
        message: message,
      },
      headers: { 'Content-Type': 'application/json' },
    },
  );

  returnData.push({ json: response, pairedItem: i });
}
```

---

### Step 4 — Required Fields for Every Node Property

Every property in `description.properties` needs these fields:

| Field            | Required       | Description                     | Example                                 |
| ---------------- | -------------- | ------------------------------- | --------------------------------------- |
| `displayName`    | ✅             | Label shown in n8n UI           | `'Phone Number'`                        |
| `name`           | ✅             | Internal key, camelCase, unique | `'phoneNumber'`                         |
| `type`           | ✅             | Input type (see types below)    | `'string'`                              |
| `default`        | ✅             | Default value                   | `''`                                    |
| `displayOptions` | ✅             | When to show this field         | `{ show: { agentType: ['smsAgent'] } }` |
| `description`    | ⚠️ recommended | Help text shown below field     | `'Recipient number'`                    |
| `placeholder`    | ⚠️ recommended | Placeholder text inside input   | `'+911234567890'`                       |
| `required`       | ⚠️ optional    | Marks field as required         | `true`                                  |

#### Available `type` values:

| Type                | Use for                                     |
| ------------------- | ------------------------------------------- |
| `'string'`          | Text input                                  |
| `'number'`          | Number input                                |
| `'boolean'`         | Toggle on/off                               |
| `'options'`         | Dropdown (static list)                      |
| `'multiOptions'`    | Multi-select dropdown                       |
| `'collection'`      | Group of optional fields (Add Field button) |
| `'fixedCollection'` | Group of repeatable fields                  |
| `'resourceMapper'`  | Dynamic form fields from API                |
| `'json'`            | JSON editor                                 |

#### n8n ESLint Rules to follow (or publish will fail):

| Rule                        | Correct                     | Wrong               |
| --------------------------- | --------------------------- | ------------------- |
| Placeholder with ID         | `'session-id'`              | `'session-ID'`      |
| Dynamic options displayName | `'Template Name or ID'`     | `'Template Name'`   |
| Description on options type | add description             | missing description |
| noDataExpression on options | add for top-level dropdowns | missing             |

Run this to auto-fix lint errors before publishing:

```bash
npx eslint nodes credentials package.json --fix
```

---

### Step 5 — Add Execute Logic

Inside `execute()`, always follow this pattern:

```typescript
// 1. Get parameters
const myParam = this.getNodeParameter('myParam', i, '') as string;

// 2. Call API using credentials (never hardcode API keys)
const response = await this.helpers.httpRequestWithAuthentication.call(this, 'kippsAiApi', {
	method: 'POST' as IHttpRequestMethods,
	url: `${baseUrl}/your-endpoint/`, // baseUrl comes from credentials
	body: { key: myParam },
	headers: { 'Content-Type': 'application/json' },
});

// 3. Push result
returnData.push({ json: response, pairedItem: i });
```

**Important rules:**

- Always use `${baseUrl}` — never hardcode `https://backend.kipps.ai` directly. `baseUrl` comes from credentials so developers can test locally with `http://host.docker.internal:8000`
- Always wrap in `try/catch` — already handled by the outer loop
- Use `this.getNodeParameter('name', itemIndex, defaultValue)` — always pass `itemIndex` (the `i` variable)

---

### Step 6 — Test Locally with Docker

**Before publishing, always test locally.**

#### 6a. Build the node

```bash
npm run build
```

Check that `dist/nodes/KippsAi/KippsAi.node.js` exists.

#### 6b. Start Docker Desktop

Make sure Docker Desktop is running (whale icon in taskbar).

#### 6c. Run n8n with your node mounted

**Windows (PowerShell) — run from inside `n8n-nodes-kipps` folder:**

```powershell
docker run -it --rm -p 5678:5678 `
  -v "$env:USERPROFILE\.n8n:/home/node/.n8n" `
  -v "${PWD}:/home/node/.n8n/custom" `
  -e N8N_CUSTOM_EXTENSIONS_MODE=paths `
  -e N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom `
  n8nio/n8n
```

**Mac/Linux:**

```bash
docker run -it --rm -p 5678:5678 \
  -v "$HOME/.n8n:/home/node/.n8n" \
  -v "$(pwd):/home/node/.n8n/custom" \
  -e N8N_CUSTOM_EXTENSIONS_MODE=paths \
  -e N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom \
  n8nio/n8n
```

#### 6d. Open n8n

Go to `http://localhost:5678` → create a new workflow → search **"Kipps"**

#### 6e. Test with local backend

In the **Kipps.AI API** credential, set **Base URL** to:

```
http://host.docker.internal:8000
```

This routes API calls to your local Django server (`python manage.py runserver`) instead of production.

#### 6f. After any code change

```bash
npm run build
# Ctrl+C the Docker container, then re-run the docker run command
```

---

### Step 7 — Publish a New Version

Publishing is **fully automated via GitHub Actions**. Never run `npm publish` manually.

#### 7a. Bump the version in `package.json`

```json
"version": "1.0.2"
```

Follow semantic versioning:

- Bug fix → `1.0.1` → `1.0.2`
- New feature (new agent type) → `1.0.1` → `1.1.0`
- Breaking change → `1.0.1` → `2.0.0`

#### 7b. Commit and push

```bash
git add .
git commit -m "feat: add SMS agent type"
git push
```

#### 7c. Create a GitHub Release

1. Go to `github.com/KIPPS-AI/n8n-nodes-kipps`
2. Click **"Releases"** → **"Create a new release"**
3. Tag: `v1.0.2` (must match `package.json` version)
4. Title: `v1.0.2`
5. Click **"Publish release"**

#### 7d. GitHub Actions automatically:

- Installs dependencies
- Builds the project
- Lints the code
- Publishes to npm **with provenance** ✅

Watch progress at: `github.com/KIPPS-AI/n8n-nodes-kipps/actions`

---

## Credentials

The node uses **KippsAiApi** credential with two fields:

| Field    | Description                        | Default                    |
| -------- | ---------------------------------- | -------------------------- |
| API Key  | Kipps.AI API key from your account | —                          |
| Base URL | Backend URL                        | `https://backend.kipps.ai` |

**For local testing**, set Base URL to: `http://host.docker.internal:8000`  
**For production**, keep it as: `https://backend.kipps.ai`

Credential file: `credentials/KippsAiApi.credentials.ts`

---

## Common Errors & Fixes

| Error                                                | Fix                                                      |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `NodeConnectionTypes not exported`                   | Use `NodeConnectionType` (no `s`)                        |
| `defaultValue does not exist in ResourceMapperField` | Remove `defaultValue` from field definition              |
| `hideNoDataError does not exist`                     | Remove it from `resourceMapper` options                  |
| `Use 'ID' [autofixable]`                             | Run `npx eslint nodes credentials --fix`                 |
| `End with 'Name or ID'`                              | Dynamic options `displayName` must end with `Name or ID` |
| `Docker daemon not running`                          | Start Docker Desktop first                               |
| `npm 403 Forbidden`                                  | Use granular access token from npmjs.com                 |
| `localhost:8000 not reachable from Docker`           | Use `host.docker.internal:8000` instead                  |

---

## Tech Stack

- **TypeScript** — node is written in TypeScript, compiled to JS
- **n8n-workflow** — n8n's SDK for building nodes
- **gulp** — copies SVG icons to `dist/`
- **eslint-plugin-n8n-nodes-base** — n8n specific lint rules
- **GitHub Actions** — automated build + publish with provenance

---

## Support

- Docs: [docs.kipps.ai](https://docs.kipps.ai)
- Email: tech@kipps.ai
- npm: [npmjs.com/package/n8n-nodes-kipps](https://www.npmjs.com/package/n8n-nodes-kipps)
