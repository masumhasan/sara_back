# SARA Backend Architecture Implementation Plan (Detailed)

This document provides a highly detailed architectural blueprint for the SARA backend. It is designed to be fully scalable, robust, and entirely composed of generous free-tier services.

---

## 1. Complete Free-Tier Technology Stack

| Service Layer | Technology | Free Tier Limits | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend** | Netlify | 100GB Bandwidth / 300 min build | Hosts the Next.js React UI and static assets. |
| **Core Backend API** | Vercel (Hobby) | 100k Requests / 10s timeout | Stateless API routes for tool execution, webhooks, and cron jobs. |
| **Real-time WebRTC** | LiveKit Cloud | 50GB Bandwidth / 50 concurrent | Facilitates low-latency voice and video streaming. |
| **Agent Worker** | Node.js (Local/Render) | 750 hours/month (Sleeps if idle) | Hosts the persistent LiveKit Agent to handle audio processing. |
| **Speech-to-Text** | Groq (Whisper API) | Free Tier | Rapid, free audio transcription. |
| **Text-to-Speech** | Cartesia | Free Developer Tier | Ultra-realistic, low-latency voice synthesis. |
| **Database & Vector** | Supabase | 500MB DB / 2GB Bandwidth / pgvector | Replaces MongoDB & Pinecone. Stores relational data, tool logs, and semantic vectors. |
| **Memory Engine** | Mem0 | Open Source / Self-Hosted | Connects to Supabase to extract and retrieve long-term contextual memory. |
| **Intelligence** | NVIDIA NIM (Free API) | 1,000+ free API credits | The core brain for NLP, tool routing, and reasoning (using models like Llama-3 hosted by NVIDIA). |

---

## 2. Component Architecture & Data Flow

To bypass Vercel's 10-second serverless timeout limit while maintaining real-time voice, the architecture is split into two distinct backend environments: **The Stateless API (Vercel)** and **The Stateful Worker (Render)**.

### A. The Stateful Worker (LiveKit Agent on Render.com)
Because LiveKit requires a persistent connection to listen to the user's microphone and stream audio back, it cannot run on Vercel. 
*   **Deployment:** A Dockerized Python or Node.js script running on a free Render.com Web Service.
*   **Responsibilities:**
    1. Connects to the LiveKit Cloud Room as a participant.
    2. Listens to the user's audio stream and performs STT (Speech-to-Text).
    3. Sends the transcribed text to the Vercel API for processing.
    4. Receives the text response from Vercel.
    5. Performs TTS (Text-to-Speech) and streams the audio back to the user via LiveKit.

### B. The Stateless API (Next.js API on Vercel)
Located in your `D:\GitHub\AIS\sara_back` repository.
*   **Deployment:** Vercel (connected to GitHub for auto-deployments).
*   **Responsibilities:**
    1. **Authentication:** Minting connection tokens for the Frontend to securely connect to LiveKit.
    2. **Orchestration (`/api/chat`):** Receives transcribed text from the Render Worker.
    3. **Memory Retrieval:** Queries Supabase (via Mem0) for past context ("User likes concise answers").
    4. **LLM Inference:** Sends the prompt, context, and available tools to the NVIDIA NIM API.
    5. **Tool Execution:** If NVIDIA's LLM requests a tool (e.g., "Check Weather"), the Vercel API executes the tool logic and feeds the result back to the LLM.
    6. **Database Logging:** Saves the entire conversation turn and tool execution metrics to Supabase.

### C. Supabase Edge Functions (Optional but Powerful)
While Vercel handles 90% of the API traffic, Supabase Edge Functions (which run geographically close to your Supabase database) can be introduced for specific scenarios to drastically improve performance or enable reactive workflows:
*   **Deployment:** Managed entirely inside your Supabase project (written in Deno/TypeScript).
*   **Responsibilities (When to use them):**
    1. **Database Webhooks:** If you want logic to run *automatically* when data changes (e.g., if a new user signs up in the `users` table, an Edge Function automatically initializes their Mem0 profile).
    2. **Heavy Data Processing:** If a specific tool requires executing 50 consecutive queries, running it as an Edge Function is 10x faster than Vercel because there is zero network latency to the database.
    3. **Background Cron Jobs (pg_cron):** Instead of using Vercel Cron, you can use PostgreSQL's native `pg_cron` to trigger Supabase Edge functions for database cleanup.

---

## 3. Supabase Database Schema (Brainstorming)

By consolidating MongoDB and Pinecone into Supabase, we use standard PostgreSQL tables alongside the `pgvector` extension.

*   **`users` table:** Core user profiles and preferences.
*   **`sessions` table:** Active or past conversation metadata (Start time, End time, tokens used).
*   **`messages` table:** Standard chat history (Role: User/Assistant, Content, Timestamp).
*   **`tool_logs` table:** Stores every tool SARA executes for observability (Tool Name, Input Params, Output, Latency, Success/Fail).
*   **`memories` table (pgvector):** Managed by Mem0. Stores high-dimensional embeddings of facts SARA learns about the user for semantic similarity search.

---

## 4. Background Workflows & Automations

Vercel provides free Cron Jobs that can ping an API route on a schedule.

*   **Cleanup Cron (`/api/cron/cleanup`):** Runs weekly to delete empty sessions or compress old chat logs in Supabase to save on the 500MB limit.
*   **Proactive Agent Cron (`/api/cron/proactive`):** Runs daily to check SARA's to-do list. If a background task is due, SARA can execute a tool (e.g., sending an email report) without the user actively opening the app.

---

## 5. Implementation Roadmap (Current Status)

1.  **Phase 0: Proof-of-Concept Voice Pipeline (COMPLETED)**
    *   Initialize `sara_back` as a Node.js Express server to mint LiveKit tokens.
    *   Create a LiveKit Agent Worker (`agent.js`) using `@livekit/agents`.
    *   Integrate NVIDIA NIM (Llama 3) for reasoning.
    *   Integrate Groq (Whisper) for STT and Cartesia for TTS.
    *   Wire the `aisara_frontend` to connect to the LiveKit Room and sync UI state with the agent's state.
2.  **Phase 1: Foundation (Next Steps)** 
    *   Set up Supabase project, get API keys, and configure database tables and row-level security.
3.  **Phase 2: The Brain** 
    *   Build the core API routes integrating tools and Mem0 connected to Supabase.
4.  **Phase 3: Deployment** 
    *   Deploy the LiveKit Agent Worker to Render.com to handle the persistent WebRTC connection remotely.

---

## 6. Tools & Capabilities Roadmap (Tailored for Nur Hasan Masum)

Based on your role as a Technical Founder, SARA will be built in distinct phases to act as your ultimate Chief of Staff. *Note: Web3 and Blockchain capabilities have been explicitly excluded from the current roadmap and pushed to an indefinite future phase.*

### Phase 1 (The First Build)
This phase focuses on immediate productivity, project tracking, and communication.
*   **Email Integration (SMTP/IMAP):** SARA can read incoming emails, categorize them (client vs junk), and draft replies for your approval.
*   **Microsoft Teams Integration:** Connect via Microsoft Graph API. SARA can monitor specific channels, summarize daily project updates, read client messages, and give you a daily voice briefing.
*   **Calendar Access:** Deep integration with your Outlook/Google Calendar. SARA can check your availability, schedule meetings, and remind you of upcoming events before they start.
*   **Kanban Task Manager:** A built-in Kanban tool page in the frontend. SARA will have backend tools to create, read, update, and move tickets based on your voice commands or from summarized MS Teams messages.
*   **GitHub Tracking:** SARA can monitor your `aisara`, `sara_back`, and other repositories, notifying you of PRs or failed builds.

### Future Phases
Once the core foundation is stable, we will expand SARA's reach:
*   **Social Media Manager:** Automated cross-posting and analytics tracking for Telegram, LinkedIn, and X (Twitter).
*   **WhatsApp Automation:** Direct integration with Meta's Cloud API to handle company messaging or alert you of urgent production bugs.
*   **Research Assistant:** Scraping tools for ArXiv and ResearchGate to ingest new AI/ML papers directly into SARA's vector memory.

---

## Open Questions for Brainstorming

> [!TIP]
> **No code will be executed until you explicitly ask.**

1.  **Render vs Railway:** For the persistent LiveKit worker, Render's free tier spins down (sleeps) after 15 minutes of inactivity. The next time you talk to SARA, it will take ~30-50 seconds to wake up. Are you okay with this cold-start delay, or would you prefer a workaround?
2.  **Authentication:** Do you want SARA to be completely private (only you can log in), or will it be a multi-tenant app where anyone can sign up and get their own SARA instance?
