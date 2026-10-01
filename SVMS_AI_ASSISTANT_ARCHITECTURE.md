# AI Student Assistant — Complete Architecture Design

**Document type:** Architecture design (pre-implementation)
**Base:** `SVMS_AI_INTEGRATION_AUDIT.md` (read first)
**Branch:** `feat/ai-student-assistant`
**Date:** 2026-10-01
**Status:** Design only — no code is to be written until this design is reviewed and approved.

---

## 0. Honesty Check — Mapping the Example Questions to Real SVMS Data

The user listed 8 example questions. Before designing, we must be honest about which of them the **current** SVMS database can actually answer. The audit found that this is a study-abroad agency CRM, **not** a school LMS. There is no `Result`, `Attendance`, `Assignment`, or `CourseEnrollment` model.

| # | Example question | Source in current SVMS | Status |
|---|---|---|---|
| 1 | "What is my GPA?" | `AcademicRecord.result` (free-text, e.g. "3.8/4.0") — pre-admission credential, not live GPA | ✅ Answerable from existing data (Phase 1) |
| 2 | "Show my current courses." | `Application.course` + `Application.course.name` — the course the student has *applied* to, not enrolled courses | ⚠️ Partial — answerable as "your applied course is X" (Phase 1) |
| 3 | "When is my next class?" | **No class schedule model exists** | ❌ Not answerable — requires schema extension (Phase 3+) |
| 4 | "What assignments are pending?" | **No assignment model exists.** Closest analog: `Task` (assigned by counselor, not academic assignments) | ⚠️ Answerable as "your pending tasks" (Phase 1) — different semantics |
| 5 | "What is my attendance?" | **No attendance model exists** | ❌ Not answerable — requires schema extension (Phase 3+) |
| 6 | "Show my recent results." | `AcademicRecord.result` (historical transcripts) + `EnglishProficiency` (IELTS/TOEFL scores) | ✅ Answerable from existing data (Phase 1) |
| 7 | "What subjects am I taking?" | Same as #2 — `Application.course` is a single course, not "subjects" | ⚠️ Partial (Phase 1) |
| 8 | "What notifications do I have?" | `Notification` model — fully present | ✅ Answerable from existing data (Phase 1) |

### What this means for the design

The architecture below is designed to be **data-source agnostic** — the tool layer abstracts over whatever data exists. Phase 1 ships with tools that answer questions 1, 2, 4 (as "tasks"), 6, 7, and 8. Questions 3 and 5 require adding `ClassSchedule` and `Attendance` models to Prisma — that is a Phase 3 schema extension, not an AI architecture change. The AI architecture itself does not need to change when those models are added; we simply register new tools (`getClassSchedule(studentId)`, `getAttendanceSummary(studentId)`) that read from the new models.

**This separation — AI orchestration vs. data availability — is the core design principle of the architecture below.**

---

## 1. Architecture Overview + Text Diagram

### High-level flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                           STUDENT (human)                             │
│                  Authenticated via NextAuth v5 JWT                    │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       STUDENT PANEL (browser)                         │
│  Next.js 16 App Router · React 19 · TanStack Query v5                 │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  AI Chat UI  (components/student/assistant/)                    │ │
│  │  ┌───────────────────────────────────────────────────────────┐  │ │
│  │  │ • Floating button (bottom-right)                          │  │ │
│  │  │ • Slide-up panel (mobile) / side panel (desktop)          │  │ │
│  │  │ • Message list (streaming)                                │  │ │
│  │  │ • Quick-suggestion chips                                  │  │ │
│  │  │ • Input box (Enter to send, Shift+Enter for newline)      │  │ │
│  │  │ • "AI may make mistakes" disclaimer                       │  │ │
│  │  │ • "Report a problem" link → creates SupportRequest        │  │ │
│  │  └───────────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ POST /api/student/assistant/chat
                                   │ (SSE stream — same pattern as
                                   │  /api/student/events)
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      SVMS BACKEND (Next.js API route)                 │
│  app/api/student/assistant/chat/route.ts                              │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 1. AUTHENTICATION                                               │ │
│  │    studentApiGuard() → derives studentId from NextAuth session  │ │
│  │    (NEVER from client input — closes IDOR)                      │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 2. AUTHORIZATION                                                │ │
│  │    hasPermission(role, "student.assistant")  →  STUDENT only    │ │
│  │    SystemSetting.ai_assistant_enabled  →  global kill switch    │ │
│  │    StudentPreference.ai_assistant_enabled  →  per-student opt   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 3. RATE LIMITING                                                │ │
│  │    lib/ai/rate-limit.ts                                         │ │
│  │    • Per-student: 20 msgs/hour, 50 msgs/day                     │ │
│  │    • Per-IP: 30 msgs/hour (catches session sharing)             │ │
│  │    • Burst: max 5 msgs/minute                                   │ │
│  │    Returns 429 with Retry-After header when exceeded            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 4. INPUT VALIDATION                                             │ │
│  │    zod schema: { message: string(1..2000), conversationId? }   │ │
│  │    Reject empty, reject > 2000 chars, strip control chars       │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 5. CONVERSATION LOAD                                            │ │
│  │    Load AiConversation + last 20 AiMessages                     │ │
│  │    If no conversationId → create new AiConversation             │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 6. CONTEXT BUILD                                                │ │
│  │    lib/ai/context.ts → buildStudentContext(studentId)           │ │
│  │    Returns: { firstName, stage, country, courseName }           │ │
│  │    NEVER includes: passport, password hash, other students      │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 7. AGENT ORCHESTRATION                                          │ │
│  │    lib/ai/agent.ts → runAgent({ studentId, context, history })  │ │
│  │    • Build system prompt + tool definitions                     │ │
│  │    • Call LLM with streaming                                    │ │
│  │    • If LLM requests a tool → dispatch via ToolRegistry         │ │
│  │    • Loop: tool result → LLM → (tool call | final answer)       │ │
│  │    • Max 5 tool-call rounds per request (prevents infinite)     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 8. SSE STREAM                                                   │ │
│  │    Stream tokens back to client (same pattern as                │ │
│  │    /api/student/events)                                         │ │
│  │    Heartbeat every 15s                                          │ │
│  │    On completion: persist AiMessage rows, log to AuditLog       │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        AI AGENT LAYER (NEW)                           │
│  lib/ai/agent.ts                                                      │
│                                                                       │
│  Responsibilities:                                                    │
│  • Orchestrate the LLM ↔ tool loop                                    │
│  • Enforce the max-rounds limit (5)                                   │
│  • Enforce the token budget (4K input, 1K output)                     │
│  • Detect prompt injection (heuristic + LLM-based guard)              │
│  • Detect and refuse cross-student data requests                      │
│  • Format tool results for the LLM                                    │
│  • Stream tokens to the SSE response                                  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  System Prompt (lib/ai/prompts/student-assistant.ts)            │ │
│  │  • Role: "You are Euroscope AI, a study-abroad assistant"      │ │
│  │  • Scope: "Only answer about THIS student's data"              │ │
│  │  • Refusal: "If asked about another student, refuse"           │ │
│  │  • Refusal: "If asked for legal/medical/financial advice,      │ │
│  │    decline and suggest contacting the counselor"               │ │
│  │  • Tools: "Use tools to fetch data — never guess"              │ │
│  │  • Language: "Match the student's preference (en/bn)"          │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        AI SERVICE LAYER (NEW)                         │
│  lib/ai/provider.ts                                                   │
│                                                                       │
│  Responsibilities:                                                    │
│  • Abstract the LLM provider (OpenAI / Anthropic / Azure)             │
│  • Manage API key from env (AI_PROVIDER_API_KEY)                      │
│  • Streaming chat completions with tool-calling support               │
│  • Token counting + budget enforcement                                │
│  • Retry with exponential backoff (max 3 retries, 2/4/8s)             │
│  • Circuit breaker (if 5 consecutive failures in 60s → fail fast)    │
│  • Cost tracking (log input/output tokens per request)                │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Provider Interface (lib/ai/provider.ts)                       │ │
│  │  interface AiProvider {                                         │ │
│  │    streamChat(params: {                                         │ │
│  │      model: string;                                             │ │
│  │      messages: ChatMessage[];                                   │ │
│  │      tools: ToolDefinition[];                                   │ │
│  │      maxTokens: number;                                         │ │
│  │      temperature: number;                                       │ │
│  │    }): AsyncIterable<ChatChunk>;                                │ │
│  │  }                                                              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      CONTROLLED TOOL LAYER (NEW)                      │
│  lib/ai/tools/                                                        │
│                                                                       │
│  ⚠️  THE AI MODEL NEVER ACCESSES THE DATABASE DIRECTLY.               │
│  ⚠️  Every data fetch goes through a whitelisted tool function.       │
│  ⚠️  Every tool inherits studentId from the request context —         │
│      it is NEVER passed as a parameter from the LLM.                  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  ToolRegistry (lib/ai/tools/registry.ts)                       │ │
│  │  • Maps tool name → tool implementation                        │ │
│  │  • Validates tool args with zod                                │ │
│  │  • Injects studentId into every tool call                      │ │
│  │  • Enforces per-tool timeout (5s default)                      │ │
│  │  • Logs every tool call to AuditLog                            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ getApplicationStatus         │  │ getDocumentsStatus           │  │
│  │ (studentId)                  │  │ (studentId)                  │  │
│  │ → stage, progress, country   │  │ → required/approved/rejected │  │
│  └──────────────────────────────┘  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ getTasksDue                  │  │ getAppointments              │  │
│  │ (studentId)                  │  │ (studentId)                  │  │
│  │ → pending/overdue tasks      │  │ → upcoming appointments      │  │
│  └──────────────────────────────┘  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ getPaymentSummary            │  │ getNotifications             │  │
│  │ (studentId)                  │  │ (studentId)                  │  │
│  │ → total/paid/due             │  │ → unread + recent            │  │
│  └──────────────────────────────┘  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ getAcademicRecords           │  │ getEnglishProficiency        │  │
│  │ (studentId)                  │  │ (studentId)                  │  │
│  │ → SSC/HSC/Diploma/Bachelor   │  │ → IELTS/TOEFL/PTE scores     │  │
│  │   results (GPA source)       │  │                              │  │
│  └──────────────────────────────┘  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ getAppliedCourse             │  │ getVisaStatus                │  │
│  │ (studentId)                  │  │ (studentId)                  │  │
│  │ → course name, university    │  │ → visa stage + requirements  │  │
│  └──────────────────────────────┘  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ getCounselorInfo             │  │ searchKnowledgeBase          │  │
│  │ (studentId)                  │  │ (query)  — Phase 2           │  │
│  │ → name, contact              │  │ → FAQ / general info         │  │
│  └──────────────────────────────┘  └──────────────────────────────┘  │
│                                                                       │
│  ⚠️  NO WRITE TOOLS IN PHASE 1.                                       │
│  ⚠️  Phase 2+ adds: createSupportTicket, draftMessageToCounselor      │
│      (both require explicit UI confirmation before executing)         │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   │  All tools call Prisma with
                                   │  WHERE studentId = <derived from session>
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          DATABASE (MongoDB)                           │
│  via Prisma 6 (lib/db.ts with soft-delete extension)                  │
│                                                                       │
│  Existing models (read by tools):                                     │
│  • Student, AcademicRecord, EnglishProficiency                        │
│  • Application, ApplicationStage, ApplicationStatusHistory            │
│  • Document, DocumentRequirement                                      │
│  • Task, Appointment, Notification                                    │
│  • Payment, Invoice                                                   │
│  • VisaApplication, VisaRequirement                                   │
│  • Employee (counselor), Conversation, Message                        │
│                                                                       │
│  New models (added in Phase 0):                                       │
│  • AiConversation (id, studentId, title, createdAt, updatedAt)        │
│  • AiMessage (id, conversationId, role, content, toolCalls,           │
│              tokenCount, costUsd, createdAt)                          │
│  • AiToolCall (id, messageId, toolName, args, result, durationMs,     │
│                success, createdAt) — for audit + debugging            │
│  • AiUsageDaily (id, studentId, date, messageCount, inputTokens,      │
│                  outputTokens, costUsd) — for rate-limit + cost dash   │
│                                                                       │
│  Phase 3 schema extensions (for class/attendance questions):          │
│  • ClassSchedule, Attendance, Assignment, Result                      │
│  (These are LMS models — NOT in current SVMS. Adding them is a        │
│   product decision, not an AI architecture decision.)                 │
└──────────────────────────────────────────────────────────────────────┘
```

### Compact version (for slide decks)

```
Student → Student Panel → AI Chat UI
                            │
                            ▼
                    POST /api/student/assistant/chat (SSE)
                            │
                 ┌──────────┴──────────┐
                 │  SVMS Backend       │
                 │  (Next.js route)    │
                 │                     │
                 │ 1. Auth (session)   │
                 │ 2. Authz (RBAC)     │
                 │ 3. Rate limit       │
                 │ 4. Validate (zod)   │
                 │ 5. Load conversation│
                 │ 6. Build context    │
                 │ 7. Call agent       │──┐
                 │ 8. Stream SSE       │  │
                 └─────────────────────┘  │
                                          │
                 ┌────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │  AI Agent Layer    │  orchestrates LLM ↔ tool loop
        │  lib/ai/agent.ts   │  enforces max-rounds, token budget
        └────────┬───────────┘
                 │
        ┌────────┴───────────┐
        │  AI Service Layer  │  abstracts OpenAI/Anthropic/Azure
        │  lib/ai/provider.ts│  streaming, retry, circuit breaker
        └────────┬───────────┘
                 │
        ┌────────┴───────────┐
        │  Tool Layer        │  ⚠️ ONLY path to the database
        │  lib/ai/tools/     │  ⚠️ studentId injected from session
        │                    │  ⚠️ NEVER from LLM input
        └────────┬───────────┘
                 │
        ┌────────┴───────────┐
        │  Database          │  Prisma 6 → MongoDB
        │  (existing + new   │  Student-scoped WHERE clauses
        │   AiConversation)  │
        └────────────────────┘
```

---

## 2. Responsibility Matrix

| Concern | Frontend | Backend (API route) | AI Service | Tools | Database |
|---|---|---|---|---|---|
| **Render chat UI** | ✅ Owns | — | — | — | — |
| **Send message** | ✅ Owns | — | — | — | — |
| **Display streaming response** | ✅ Owns | — | — | — | — |
| **Quick-suggestion chips** | ✅ Owns | — | — | — | — |
| **Authentication** | — | ✅ Owns (studentApiGuard) | — | — | — |
| **Authorization (RBAC)** | — | ✅ Owns (guard + SystemSetting) | — | — | — |
| **Rate limiting** | — | ✅ Owns (per-student + per-IP) | — | — | — |
| **Input validation** | ✅ Client-side (UX) | ✅ Owns (zod, authoritative) | — | — | — |
| **Conversation load/persist** | — | ✅ Owns | — | — | Executes |
| **Context sanitization** | — | ✅ Owns (buildStudentContext) | — | — | — |
| **LLM orchestration loop** | — | Delegates to | ✅ Owns (agent.ts) | — | — |
| **LLM API call** | — | — | ✅ Owns (provider.ts) | — | — |
| **Streaming tokens** | — | Receives from service | ✅ Owns | — | — |
| **Token counting + budget** | — | — | ✅ Owns | — | — |
| **Retry / circuit breaker** | — | — | ✅ Owns | — | — |
| **Tool dispatch** | — | — | ✅ Owns (agent → registry) | — | — |
| **Tool arg validation** | — | — | — | ✅ Owns (zod per tool) | — |
| **studentId injection** | — | — | — | ✅ Owns (from context, not LLM) | — |
| **Data fetch (scoped)** | — | — | — | ✅ Owns (Prisma queries) | Executes |
| **Soft-delete filter** | — | — | — | Inherits (Prisma extension) | ✅ Owns |
| **Audit log** | — | ✅ Owns (message-level) | — | ✅ Owns (tool-call-level) | Stores |
| **Cost tracking** | — | — | ✅ Owns (per request) | — | Stores (AiUsageDaily) |
| **Error handling** | ✅ UI fallback | ✅ Envelope errors | ✅ Provider errors | ✅ Tool errors | — |
| **Kill switch** | Reads (disables UI) | ✅ Owns (SystemSetting) | — | — | Stores |

### Summary of separation
- **Frontend** never calls the LLM directly. It only talks to the SVMS backend.
- **Backend** never lets the LLM touch the database. It mediates everything.
- **AI service** never knows the student's identity. It receives a sanitized context + tool registry.
- **Tools** never trust the LLM for identity. They inherit `studentId` from the request context.
- **Database** enforces nothing AI-specific. It just runs scoped Prisma queries.

---

## 3. AI Service Layer (`lib/ai/provider.ts`)

### Purpose
Abstract the LLM provider so the agent layer is provider-agnostic. Swapping OpenAI for Anthropic (or vice versa) should require changes only in `provider.ts`, not in `agent.ts` or any tool.

### Interface
```typescript
interface AiProvider {
  streamChat(params: {
    model: string;
    messages: ChatMessage[];
    tools: ToolDefinition[];
    maxInputTokens: number;   // hard limit — reject if exceeded
    maxOutputTokens: number;  // hard limit — stop generation
    temperature: number;      // 0.0–1.0 (default 0.3 for factual answers)
  }): AsyncIterable<ChatChunk>;

  countTokens(messages: ChatMessage[]): number;
  estimateCost(inputTokens: number, outputTokens: number): number;
}

type ChatChunk =
  | { type: "text"; text: string }
  | { type: "tool_call"; id: string; name: string; args: unknown }
  | { type: "done"; inputTokens: number; outputTokens: number; finishReason: string }
  | { type: "error"; code: string; message: string };
```

### Concrete implementations
- `OpenAiProvider` — uses `openai` npm package, `gpt-4o-mini` model default
- `AnthropicProvider` — uses `@anthropic-ai/sdk`, `claude-haiku-4` model default
- `MockProvider` (dev only) — returns canned responses, no API key needed

### Configuration (env vars)
```
AI_PROVIDER=openai              # openai | anthropic | azure | mock
AI_PROVIDER_API_KEY=sk-...      # provider API key
AI_PROVIDER_MODEL=gpt-4o-mini   # default model
AI_PROVIDER_BASE_URL=           # optional (for Azure or self-hosted)
AI_MAX_INPUT_TOKENS=4000        # hard limit per request
AI_MAX_OUTPUT_TOKENS=1000       # hard limit per response
AI_TEMPERATURE=0.3              # low for factual answers
```

### Reliability features
- **Retry:** exponential backoff (2s, 4s, 8s) for 429 + 5xx errors. No retry for 4xx (client errors).
- **Circuit breaker:** if 5 consecutive failures in 60s → return `503 AI service unavailable` for the next 60s (fail fast, don't queue).
- **Timeout:** 30s per LLM call (excluding streaming). If the LLM doesn't start streaming within 30s, abort.
- **Streaming:** tokens are forwarded to the SSE response as they arrive — the student sees the answer being typed, not a 10-second spinner.

### Cost tracking
Every request logs to `AiUsageDaily` (aggregated per student per day):
- `inputTokens`, `outputTokens`, `costUsd` (estimated)
- `messageCount`
- This powers the admin cost dashboard + the per-student daily cap.

---

## 4. Agent Layer (`lib/ai/agent.ts`)

### Purpose
Orchestrate the LLM ↔ tool loop. The agent is the "brain" that decides when to call a tool, when to answer directly, and when to refuse.

### The agent loop
```
1. Build system prompt (role + scope + refusal rules + student context)
2. Build message history (last 20 AiMessages from this conversation)
3. Build tool definitions (from ToolRegistry)
4. Call provider.streamChat()
5. For each chunk:
   - if text → forward to SSE stream
   - if tool_call → break out of stream, execute tool, append result to messages, goto 4
   - if done → break
   - if error → forward error to SSE stream, break
6. Persist final assistant message to AiMessage
7. Log to AuditLog (action: "ai.assistant_message", entityId: conversationId)
```

### Guards enforced by the agent
| Guard | Value | Reason |
|---|---|---|
| Max tool-call rounds | 5 | Prevents infinite loops if the LLM keeps calling tools |
| Max input tokens | 4,000 | Hard cap from env — request rejected if exceeded |
| Max output tokens | 1,000 | Hard cap from env — generation stops mid-sentence if needed |
| Temperature | 0.3 | Low temperature = factual, not creative |
| History window | 20 messages | Keeps context small + cost predictable |
| Tool timeout | 5s per tool | A slow DB query shouldn't hang the chat |
| Total request timeout | 60s | If everything takes too long, abort + return error |

### Prompt-injection defense
The agent runs two checks on the user's message before sending it to the LLM:

1. **Heuristic check** — reject if the message contains:
   - "ignore previous instructions"
   - "you are now" / "act as" / "pretend to be"
   - "show me all students" / "show me user IDs" / "show me passwords"
   - Base64-encoded blobs > 500 chars
   - > 3 URL references (potential data exfiltration)

2. **LLM-based guard** (optional, Phase 2) — a second LLM call classifies the message as `safe` / `suspicious` / `malicious`. If `malicious`, refuse + log to `SecurityEvent`.

### Refusal rules (in the system prompt)
The assistant MUST refuse to:
- Discuss another student's data (even if the student claims to be an admin)
- Provide legal, medical, or financial advice
- Generate code, essays, or academic content on behalf of the student
- Access or reveal system configuration, API keys, or internal logs
- Pretend to be a human counselor

When refusing, the assistant should explain why + suggest the appropriate action (e.g. "For visa advice, please contact your counselor — here's their contact info").

---

## 5. Tool Layer (`lib/ai/tools/`)

### Purpose
The **only** path from the AI to the database. Each tool is a small, audited, zod-validated function that fetches a specific slice of student data.

### Tool interface
```typescript
interface AiTool {
  name: string;
  description: string;           // shown to the LLM
  parameters: z.ZodSchema;       // LLM-provided args (NEVER includes studentId)
  execute: (args: unknown, ctx: ToolContext) => Promise<unknown>;
}

interface ToolContext {
  studentId: string;             // injected from session — NOT from LLM
  userId: string;
  requestId: string;             // for log correlation
  timeoutMs: number;             // default 5000
}
```

### Phase 1 tool registry (read-only)

| Tool | LLM-facing description | Returns | Source model |
|---|---|---|---|
| `getApplicationStatus` | "Get the student's current application stage, progress %, and destination country" | `{ stage, progress, country, university, course, applicationNumber }` | `Application` + `ApplicationStage` |
| `getDocumentsStatus` | "Get a summary of the student's documents — required, approved, pending, rejected" | `{ required, approved, pending, rejected, underReview, items: [{name, status}] }` | `Document` + `DocumentRequirement` |
| `getTasksDue` | "Get the student's pending and overdue tasks" | `{ today: [...], upcoming: [...], overdue: [...] }` | `Task` |
| `getAppointments` | "Get the student's upcoming appointments with their counselor" | `{ next: {...}, upcoming: [...] }` | `Appointment` + `Employee` |
| `getPaymentSummary` | "Get a summary of the student's payments — total, paid, due" | `{ total, paid, due, currency, nextPayment? }` | `Payment` + `Invoice` |
| `getNotifications` | "Get the student's recent unread notifications" | `{ unreadCount, recent: [...] }` | `Notification` |
| `getAcademicRecords` | "Get the student's historical academic records (SSC, HSC, Bachelor, etc.)" | `{ records: [{ level, institution, result, passingYear }] }` | `AcademicRecord` |
| `getEnglishProficiency` | "Get the student's English test scores (IELTS, TOEFL, PTE)" | `{ tests: [{ testType, overallScore, ... }] }` | `EnglishProficiency` |
| `getAppliedCourse` | "Get the course the student has applied to" | `{ courseName, universityName, degreeLevel, duration, tuitionFee }` | `Application` → `Course` → `University` |
| `getVisaStatus` | "Get the student's visa application status" | `{ stage, submittedAt, decisionAt, requirements: [...] }` | `VisaApplication` + `VisaRequirement` |
| `getCounselorInfo` | "Get the student's assigned counselor's name and contact" | `{ name, title, email }` | `Employee` → `User` |

### Example tool implementation (shape only — not real code)
```typescript
// lib/ai/tools/application.ts
export const getApplicationStatus: AiTool = {
  name: "getApplicationStatus",
  description: "Get the student's current application stage, progress %, and destination country",
  parameters: z.object({}).strict(),  // no parameters — studentId comes from ctx
  async execute(_args, ctx) {
    const app = await prisma.application.findFirst({
      where: { studentId: ctx.studentId, deletedAt: null, status: "ACTIVE" },
      include: { country: true, university: true, course: true },
      orderBy: { createdAt: "desc" },
    });
    if (!app) return { hasApplication: false };
    return {
      hasApplication: true,
      applicationNumber: app.applicationNumber,
      stage: app.stageKey,
      country: app.country.name,
      university: app.university?.name ?? null,
      course: app.course?.name ?? null,
    };
  },
};
```

### Critical safety rules for tools
1. **`studentId` is always injected from `ToolContext`** — never accepted as a parameter from the LLM. This is enforced by the `ToolRegistry` which strips any `studentId` from LLM-provided args before calling `execute()`.
2. **Every Prisma query includes `where: { studentId: ctx.studentId }`** — even if a tool accidentally omits it in code review, the registry can wrap queries in a Prisma extension that rejects unscoped reads (Phase 2 hardening).
3. **No PII in tool results** — tools must not return passport numbers, password hashes, or other students' data. The `buildStudentContext` function defines a whitelist of safe fields.
4. **Tools are read-only in Phase 1** — no `create`, `update`, `delete` operations. Write tools (`createSupportTicket`, `draftMessageToCounselor`) arrive in Phase 2 and require explicit UI confirmation.
5. **Tool results are logged** — every call writes to `AiToolCall` (toolName, args, result summary, durationMs, success) for audit + debugging.

---

## 6. Authentication Flow

```
1. Student logs in via /login (NextAuth Credentials provider)
   → bcrypt verify → JWT issued (8h maxAge)
   → JWT contains: { sub, role: "STUDENT", branchId, lastChecked }

2. Student opens /student/assistant (or clicks the floating button)
   → proxy.ts (edge) checks JWT cookie → redirects to /login if absent
   → app/student/layout.tsx → requireStudentProfile()
     → auth() → session.user.role === "STUDENT"?
     → prisma.student.findFirst({ where: { userId: session.user.id, deletedAt: null } })
     → if no student profile → redirect to /403

3. Student sends a message
   → POST /api/student/assistant/chat
   → app/api/student/assistant/chat/route.ts
   → studentApiGuard()
     → auth() → session.user.id
     → session.user.role === "STUDENT"? (else 403)
     → prisma.student.findFirst({ where: { userId, deletedAt: null } })
     → returns { ok: true, userId, student } or { ok: false, error }

4. The studentId from step 3 is passed through the entire pipeline:
   → buildStudentContext(studentId)
   → runAgent({ studentId, context, history })
   → ToolRegistry.dispatch(toolName, args, { studentId, ... })
   → prisma.*.findMany({ where: { studentId } })

5. At no point does the client or the LLM provide a studentId.
   It is ALWAYS derived from the authenticated session.
```

### Periodic re-validation
NextAuth v5 already re-validates the JWT every 5 minutes (checks if the user is still ACTIVE + not deleted). This means:
- If a student is suspended mid-conversation, their next API call (within 5 min) returns 401.
- If a student is deleted, their next API call returns 401.
- The assistant does not need its own session check — it inherits this from `studentApiGuard()`.

---

## 7. Authorization Flow

### Three layers of authorization

```
Layer 1: Role check (NextAuth)
  → session.user.role === "STUDENT"
  → If not → 403 Forbidden

Layer 2: Global kill switch (SystemSetting)
  → SystemSetting.ai_assistant_enabled === true
  → If false → 503 Service Unavailable (with message "AI assistant is
    currently disabled. Please contact support.")

Layer 3: Per-student opt-out (StudentPreference — NEW field)
  → StudentPreference.ai_assistant_enabled === true (default)
  → If false → 403 with message "You have disabled the AI assistant.
    Enable it in Settings."
```

### Permission key (added to RBAC)
Add to `lib/permissions/index.ts`:
```typescript
"student.assistant": ["STUDENT"],
```

This means only STUDENT role can call `/api/student/assistant/*`. Admins and employees use their own assistant routes (Phase 4+).

### Tool-level authorization
Each tool can declare a required permission:
```typescript
interface AiTool {
  // ...
  requiredPermission?: PermissionKey;  // default: none (any student can call)
}
```

In Phase 1, all tools are open to any student. In Phase 4+, write tools like `draftMessageToCounselor` might require `student.messages` (which all students have, but the pattern is there for future role splits).

---

## 8. Database Access Flow

### The critical invariant
**The LLM never sees a database connection. It only sees tool results.**

```
LLM: "I want to call getApplicationStatus"
         │
         ▼
ToolRegistry.dispatch("getApplicationStatus", args, ctx)
         │
         │  1. Validate args with zod schema
         │  2. Inject ctx.studentId (from session, NOT from args)
         │  3. Set 5s timeout
         │  4. Log to AiToolCall (start)
         │
         ▼
getApplicationStatus.execute({}, ctx)
         │
         │  prisma.application.findFirst({
         │    where: { studentId: ctx.studentId, deletedAt: null },
         │    ...
         │  })
         │
         ▼
Database (MongoDB) returns the row
         │
         ▼
Tool returns sanitized result to registry
         │
         │  5. Log to AiToolCall (end, durationMs, success)
         │  6. Return result to agent
         │
         ▼
Agent appends tool result to message history
         │
         ▼
LLM generates final answer based on tool result
```

### What the LLM receives
The LLM sees:
- The system prompt (role + rules + student's first name + stage + country)
- The conversation history (last 20 messages)
- Tool definitions (names + descriptions + parameter schemas)
- Tool results (sanitized JSON — no PII, no other students' data)

The LLM does NOT see:
- The database connection string
- The Prisma client
- The student's `id` (only their first name + context)
- Other students' data
- Password hashes, passport numbers, or any field not in the tool's return shape

### Sanitization layer
`lib/ai/sanitize.ts` runs tool results through a whitelist before returning to the LLM:
- Strips any field not in the tool's declared return shape
- Redacts fields matching `/passport|password|hash|secret|token/i`
- Truncates long strings (> 500 chars) to prevent context overflow
- Converts `Date` objects to ISO strings (LLMs handle strings better)

---

## 9. Conversation / Session Management

### Data model (Phase 0 Prisma additions)
```prisma
model AiConversation {
  id          String      @id @default(auto()) @map("_id") @db.ObjectId
  studentId   String      @db.ObjectId
  student     Student     @relation(fields: [studentId], references: [id])
  title       String      @default("New conversation")  // auto-generated from first message
  archivedAt  DateTime?   // student can archive
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  messages    AiMessage[]

  @@index([studentId])
  @@index([updatedAt])
}

model AiMessage {
  id              String        @id @default(auto()) @map("_id") @db.ObjectId
  conversationId  String        @db.ObjectId
  conversation    AiConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role            String        // "user" | "assistant" | "tool" | "system"
  content         String        // the message text (or JSON for tool calls)
  toolCalls       Json?         // [{ id, name, args }] — when role="assistant" and tools were called
  toolCallId      String?       // when role="tool" — which tool call this responds to
  tokenCount      Int?          // input + output tokens for this message
  costUsd         Float?        // estimated cost
  createdAt       DateTime      @default(now())

  toolCallRecords AiToolCall[]

  @@index([conversationId])
  @@index([createdAt])
}

model AiToolCall {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  messageId   String    @db.ObjectId
  message     AiMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  toolName    String
  args        Json       // the args the LLM provided (studentId NOT included)
  resultSummary String  // truncated result (first 500 chars) — full result not stored to save space
  durationMs  Int
  success     Boolean
  error       String?
  createdAt   DateTime  @default(now())

  @@index([messageId])
  @@index([toolName])
}

model AiUsageDaily {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  studentId     String   @db.ObjectId
  date          DateTime  // midnight UTC of the day
  messageCount  Int      @default(0)
  inputTokens   Int      @default(0)
  outputTokens  Int      @default(0)
  costUsd       Float    @default(0)

  @@unique([studentId, date])
  @@index([date])
}
```

### Conversation lifecycle
1. **Create:** First message in a new chat → create `AiConversation` with `title = "New conversation"`. After the first assistant response, auto-generate a title via a cheap LLM call (`gpt-4o-mini` with "summarize this conversation in 5 words").
2. **Continue:** Subsequent messages in the same chat → load last 20 `AiMessage` rows, append new ones.
3. **List:** Student can see their conversations in a sidebar (Phase 2 UI).
4. **Archive:** Student can archive a conversation (sets `archivedAt`). Archived conversations don't appear in the list but can be searched.
5. **Delete:** Student can delete a conversation (hard delete — cascades to `AiMessage` + `AiToolCall`). This is the only hard-delete in the AI layer; everything else is soft.
6. **Retention:** Conversations older than 180 days with no new messages are auto-archived by a nightly cron (Phase 6).

### Session vs. conversation
- A **session** is the NextAuth JWT (8h). It has nothing to do with AI.
- A **conversation** is an `AiConversation` row. It persists across sessions, logouts, and devices.
- The student can have multiple conversations open (e.g. "Application questions", "Visa questions") — each is a separate `AiConversation`.

---

## 10. Error Handling

### Error categories + responses

| Category | HTTP status | Example | Client behavior |
|---|---|---|---|
| **Auth failure** | 401 | Session expired | Redirect to /login |
| **Authz failure** | 403 | Not a student / kill switch on / opted out | Show error toast, disable input |
| **Rate limit** | 429 | Too many messages | Show "Try again in X minutes" + disable input until Retry-After |
| **Validation** | 400 | Empty message / > 2000 chars | Show inline validation error |
| **Prompt injection** | 400 | Heuristic matched | Show "Your message was flagged. Please rephrase." + log to SecurityEvent |
| **Provider error** | 502 | OpenAI returned 500 | Show "AI service is having issues. Please try again." |
| **Circuit breaker open** | 503 | 5 consecutive failures | Show "AI assistant is temporarily unavailable." |
| **Timeout** | 504 | LLM didn't respond in 30s | Show "The AI took too long to respond. Please try again." |
| **Tool error** | 200 (SSE) | Tool threw an error | LLM receives the error as a tool result and can explain it to the student |
| **Internal error** | 500 | Unhandled exception | Show "Something went wrong. Please try again." + log to AuditLog |

### SSE error format
Errors during streaming (after the SSE connection is open) are sent as special events:
```
data: {"type":"error","code":"PROVIDER_ERROR","message":"AI service is having issues"}

data: {"type":"done"}
```
The client receives these and displays a friendly message + a "Retry" button.

### Tool error handling
If a tool throws, the agent does NOT abort the conversation. Instead:
1. The error is logged to `AiToolCall` with `success: false` + `error: <message>`.
2. The error is returned to the LLM as the tool result: `{ error: "Failed to fetch application status. Please try again." }`.
3. The LLM can then apologize to the student and suggest retrying, or fall back to a different tool.
4. If 3 consecutive tool calls fail, the agent aborts with a user-friendly error.

### Circuit breaker
- **Open threshold:** 5 consecutive provider errors in 60s
- **Open duration:** 60s (during which all requests return 503 immediately)
- **Half-open:** After 60s, allow 1 request through. If it succeeds → close. If it fails → stay open for another 60s.
- State is in-memory (single-instance only — same caveat as the SSE bus). Phase 6 migrates to Redis.

---

## 11. Logging

### Three logging layers

#### Layer 1: AuditLog (existing model — system-level events)
Every assistant request writes one `AuditLog` row:
```
{
  userId: <student's userId>,
  action: "ai.assistant_message",
  entity: "AiConversation",
  entityId: <conversationId>,
  oldValue: null,
  newValue: { messageId, messageLength, toolCalls: [...], inputTokens, outputTokens, costUsd },
  ipAddress: <from request>,
  userAgent: <from request>,
  createdAt: <now>
}
```
This is the admin-visible audit trail — visible in `/admin/audit-logs`.

#### Layer 2: AiToolCall (new model — tool-level events)
Every tool call writes one `AiToolCall` row:
```
{
  messageId: <the assistant message that triggered the call>,
  toolName: "getApplicationStatus",
  args: {},  // studentId NOT included
  resultSummary: "{ hasApplication: true, stage: 'DOCUMENT_REVIEW', ... }",  // truncated to 500 chars
  durationMs: 142,
  success: true,
  error: null
}
```
This is for debugging — "why did the AI say X?" → look at the tool calls.

#### Layer 3: Server logs (console — operational)
Structured JSON logs to stdout (Vercel captures these):
```
{
  level: "info" | "warn" | "error",
  requestId: <uuid>,
  studentId: <masked>,  // e.g. "std_abc...123"
  event: "assistant.request.start" | "assistant.tool.call" | "assistant.request.end",
  durationMs: <number>,
  tokens: { input, output },
  costUsd: <number>,
  error: <string | null>
}
```

### What is NEVER logged
- The student's full name (only the masked ID)
- Passport numbers, password hashes
- The full tool result (only the 500-char summary)
- The LLM's full message history (only the current message)
- API keys

### Log retention
- `AuditLog`: forever (existing policy)
- `AiToolCall`: 90 days (nightly cron deletes older rows)
- `AiMessage`: 180 days after the conversation is archived
- Server logs: Vercel's default (1 month)

---

## 12. Rate Limiting

### Three limits (all enforced before the LLM is called)

| Limit | Scope | Value | Key |
|---|---|---|---|
| **Burst** | Per-student | 5 messages / minute | `ai:burst:{studentId}` |
| **Hourly** | Per-student | 20 messages / hour | `ai:hourly:{studentId}` |
| **Daily** | Per-student | 50 messages / day | `ai:daily:{studentId}` |
| **IP** | Per-IP | 30 messages / hour | `ai:ip:{ip}` |

### Implementation
Reuse the existing `lib/security/rate-limit.ts` pattern (in-memory token bucket). For Phase 1 (single-instance), this is fine. For Phase 6 (multi-instance), migrate to Redis.

### Behavior when exceeded
- Return `429 Too Many Requests` with:
  ```json
  {
    "success": false,
    "error": {
      "code": "RATE_LIMITED",
      "message": "You've sent too many messages. Please try again in X minutes.",
      "retryAfter": 600  // seconds
    }
  }
  ```
- Set `Retry-After` HTTP header (seconds until the oldest bucket expires).
- The client disables the input + shows a countdown.
- Log to `SecurityEvent` (type: `rate_limit_hit`) so admins can see if a student is trying to abuse the system.

### Daily cap enforcement
The daily limit is also enforced via `AiUsageDaily` — if a student has 50 rows for today, reject immediately (without even checking the token-bucket). This is a hard cap that survives rate-limiter restarts.

### Cost cap (Phase 2)
A global cost cap: if `SUM(AiUsageDaily.costUsd)` for today > `$X` (configurable in `SystemSetting`), disable the assistant globally + alert the admin. Prevents a compromised student account from running up a huge bill.

---

## 13. Security Boundaries

### Trust zones

```
┌─────────────────────────────────────────────────────────────┐
│  UNTRUSTED ZONE                                            │
│  ┌──────────────┐                                          │
│  │  Browser     │  ← Student can send anything             │
│  └──────────────┘    (messages, fake conversationIds,      │
│                       SQL injection attempts, etc.)        │
└─────────────────────────────────────────────────────────────┘
              │
              │  All input is untrusted until validated.
              │  proxy.ts + studentApiGuard() + zod = the
              │  three gates that filter untrusted input.
              ▼
┌─────────────────────────────────────────────────────────────┐
│  SEMI-TRUSTED ZONE                                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SVMS Backend (Next.js API route)                    │  │
│  │  • Authenticated (NextAuth session)                  │  │
│  │  • Authorized (RBAC + kill switch)                   │  │
│  │  • Rate-limited                                      │  │
│  │  • Input validated (zod)                             │  │
│  │  ⚠️ The student's MESSAGE is still untrusted — it    │  │
│  │     may contain prompt injection.                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              │
              │  The message is passed to the LLM, but:
              │  - studentId is locked in ToolContext
              │  - tools refuse to accept studentId from LLM
              │  - prompt-injection heuristic runs first
              ▼
┌─────────────────────────────────────────────────────────────┐
│  EXTERNAL ZONE (least trusted)                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  LLM Provider (OpenAI / Anthropic)                   │  │
│  │  • Receives: system prompt + history + tools         │  │
│  │  • Returns: text + tool calls                        │  │
│  │  ⚠️ The LLM is an external service. It could be      │  │
│  │     compromised, leak data, or hallucinate.          │  │
│  │  ⚠️ Tool calls from the LLM are VALIDATED before     │  │
│  │     execution — the LLM cannot call arbitrary        │  │
│  │     functions, only whitelisted tools.               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              │
              │  Tool calls are sandboxed:
              │  - zod-validated args
              │  - studentId injected from session
              │  - 5s timeout
              │  - result sanitized before returning to LLM
              ▼
┌─────────────────────────────────────────────────────────────┐
│  TRUSTED ZONE                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tool Layer + Database                               │  │
│  │  • studentId is trusted (from session)               │  │
│  │  • Prisma queries are parameterized (no SQL inj.)    │  │
│  │  • Soft-delete filter is automatic                   │  │
│  │  • Tool results are sanitized before leaving         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Security invariants (must never be violated)

1. **studentId is never accepted from client input.** It is always derived from the NextAuth session in `studentApiGuard()`.
2. **studentId is never accepted from LLM input.** It is always injected by the `ToolRegistry` from the request context.
3. **The LLM never sees a Prisma client.** It can only call whitelisted tools.
4. **Tools never return PII.** The sanitization layer strips fields not in the tool's declared return shape.
5. **Tools never return other students' data.** Every Prisma query includes `where: { studentId: ctx.studentId }`.
6. **No write operations in Phase 1.** The LLM cannot mutate state — only read.
7. **Every request is rate-limited.** Burst + hourly + daily + IP — four independent limits.
8. **Every request is logged.** AuditLog (system) + AiToolCall (tool) + server logs (operational).
9. **The kill switch works without a deploy.** `SystemSetting.ai_assistant_enabled = false` → all requests return 503 immediately.
10. **Prompt injection is detected.** Heuristic + optional LLM-based guard. Suspicious messages are refused + logged.

### Threat model (top 5)

| Threat | Mitigation |
|---|---|
| **Student asks for another student's data** | Tools inject `studentId` from session; LLM cannot override it. Prisma queries are always scoped. |
| **Student uses prompt injection to bypass rules** | Heuristic check + LLM-based guard (Phase 2). System prompt has hard refusal rules. |
| **Student abuses the API for free LLM access** | Rate limit (5/min, 20/hr, 50/day) + daily cost cap (Phase 2). |
| **LLM provider leak (data sent to OpenAI)** | Context sanitization strips PII. System prompt explicitly forbids returning PII. No passport/password/financial data in tool results. |
| **Compromised student JWT** | NextAuth 5-min re-validation catches suspended/deleted accounts. Rate limit caps damage. Audit log provides forensics. |

---

## 14. Phase Boundaries (recap from the audit, scoped to this design)

| Phase | What ships | New in this design |
|---|---|---|
| **Phase 0** (1 week) | Foundation — no AI yet | `AiConversation`, `AiMessage`, `AiToolCall`, `AiUsageDaily` models; env vars; rate limiter |
| **Phase 1** (2 weeks) | Read-only student assistant | All 11 tools above; chat UI; SSE streaming; prompt-injection heuristic |
| **Phase 2** (1 week) | Knowledge base + write tools | `searchKnowledgeBase` tool; `createSupportTicket` tool (with UI confirmation); cost cap |
| **Phase 3** (1 week) | Embeddings + LMS data | `ClassSchedule`, `Attendance`, `Assignment`, `Result` models (schema extension — separate from AI); semantic search; new tools for LMS data |
| **Phase 4** (2 weeks) | Employee assistant | `/api/employee/assistant/*`; employee-scoped tools |
| **Phase 5** (1 week) | Admin analytics assistant | `/api/admin/assistant/*`; admin-scoped tools |
| **Phase 6** (1 week) | Multi-instance + hardening | Redis pub/sub (SSE + rate limit); AI cost dashboard; prompt-injection LLM guard; red-team tests |

---

## 15. Open Questions (for review before implementation)

1. **LLM provider** — OpenAI (`gpt-4o-mini`) or Anthropic (`claude-haiku-4`)? OpenAI is cheaper; Anthropic has better refusal behavior. Recommend OpenAI for Phase 1 (cost), with provider abstraction allowing swap.

2. **Conversation retention** — 180 days after archive, or shorter? GDPR/right-to-be-forgotten may require 90 days. Recommend 180 days default, configurable via `SystemSetting`.

3. **Bengali language support** — The system prompt should detect the student's `StudentPreference.language` and respond in that language. But: tool results are in English (DB data). The LLM must translate in its response. Confirm this is acceptable.

4. **Mobile keyboard** — When the chat panel opens on mobile, does the virtual keyboard cover the input? Need to test the slide-up panel's `viewport-height` handling. (UX detail, not architecture.)

5. **Cost ceiling** — What's the monthly AI budget? At $0.001–$0.01 per conversation (gpt-4o-mini), 1000 students × 10 conversations/day × 30 days = $300–$3000/month. Need a number to set the global cost cap.

6. **Accessibility** — The chat UI must be screen-reader accessible (ARIA live regions for streaming responses, keyboard navigation for the message list). Confirm this is in scope for Phase 1.

7. **Phase 3 LMS models** — Adding `ClassSchedule`, `Attendance`, `Assignment`, `Result` is a product decision (the SVMS would become a hybrid CRM + LMS). Is that the intended direction, or should those questions be answered with "This feature is not available in Euroscope"?

---

## 16. What This Design Does NOT Include (deferred)

- **No RAG over documents** — the student's uploaded documents (transcripts, passports) are NOT indexed for AI search in Phase 1. That's a Phase 3+ feature (requires OCR + embeddings + access control).
- **No voice input** — text only in Phase 1.
- **No proactive AI** — the assistant only responds to student messages; it does not initiate conversations. (Phase 4+: "You have an overdue task — want me to help?")
- **No AI-generated content moderation** — the assistant doesn't moderate the student's messages. (Phase 6: integrate with the existing `SecurityEvent` system.)
- **No multi-tenant AI config** — each deployment has one LLM provider. (Future: per-branch provider config.)

---

## Next step

This document is a **design**. No code should be written until this design is reviewed and the open questions in §15 are answered. Once approved, implementation begins with Phase 0 (Prisma models + env vars + rate limiter) as described in `SVMS_AI_INTEGRATION_AUDIT.md` §12.
