# SARA Backend Architecture Implementation Plan (Detailed)

This document provides a highly detailed architectural blueprint for the SARA backend. It has been updated to reflect the current native `@livekit/agents` Node.js implementation, ensuring a scalable, robust, and low-latency system composed of generous free-tier services.

---

## 1. Complete Technology Stack

| Service Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend & Auth** | Next.js (Vercel) | Hosts the React UI, dashboard, and API routes to mint LiveKit access tokens. |
| **Real-time WebRTC** | LiveKit Cloud | Facilitates ultra-low latency voice, video, and data streaming between the UI and Agent. |
| **Agent Worker (Core)** | Node.js (`agent.js`) | The persistent LiveKit Agent. Handles the entire pipeline: listening, reasoning, tool calling, and speaking. |
| **Voice Activity (VAD)**| Silero (Local) | Runs locally on the worker to detect when the user speaks or pauses (Free). |
| **Speech-to-Text** | OpenAI Whisper | Converts user audio to text (Currently used in `agent.js`). |
| **Language Model** | OpenAI GPT-4o-mini | The brain. Instructed via `prompt.json`, handles reasoning, conversation, and function calling. |
| **Text-to-Speech** | OpenAI TTS-1 (Nova) | Converts SARA's text responses back into audio. |
| **Database & Vector** | Supabase (PostgreSQL)| Stores relational data (users, tool logs) and semantic vectors (pgvector) for long-term memory. |

---

## 2. Component Architecture & Data Flow

Unlike traditional chatbot architectures that rely on stateless serverless functions (like Vercel API routes), voice agents require a **Stateful Worker**. 

### A. The LiveKit Agent Worker (`agent.js`)
This is the heart of SARA. It runs as a persistent Node.js process.
1. **Connection:** Connects to the LiveKit Cloud Room.
2. **Audio Pipeline:** Uses `@livekit/agents-plugin-silero` to detect speech, and routes it to OpenAI Whisper for STT.
3. **Orchestration:** The `@livekit/agents` SDK natively manages the conversation history. When STT completes, the text is fed into the LLM (GPT-4o-mini).
4. **Tool Execution:** If the LLM needs external data, it triggers a function defined in `tools.js` (e.g., `search_web`, `get_weather`). The worker executes this locally and feeds the result back to the LLM.
5. **Memory Injection (Planned):** Before sending user input to the LLM, the worker will query Supabase to retrieve relevant past memories (RAG) and inject them into the LLM context.
6. **Playout:** The LLM's streaming response is routed to OpenAI TTS, which streams audio chunks directly back to the LiveKit room.

### B. The Frontend (`aisara_frontend`)
1. User clicks "Connect".
2. Frontend calls a Next.js API route to generate a LiveKit Access Token using your `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
3. Frontend connects to LiveKit Cloud using the token.
4. The Agent Worker detects the new participant and greets them.

---

## 3. Tool Ecosystem (`tools.js`)

The agent is currently equipped with native LLM function calling capabilities:
*   **`get_weather`:** Calls the `wttr.in` API to fetch real-time weather data.
*   **`search_web`:** A custom DuckDuckGo scraper using `cheerio` that bypasses anti-bot detection to retrieve real-time news and facts from the internet.
*   **`get_current_time`:** Provides the agent with spatial/temporal awareness.

---

## 4. Upcoming Long-Term Memory (LTM) Implementation

To give SARA persistent memory across sessions without blowing up token costs or polluting context, we will use the **"Digital Notebook" (Tool-based)** approach instead of naive chat summarization. We will integrate Supabase's `pgvector` for this purpose.

### Database Schema (Supabase)
We will create a single, dedicated table for SARA's semantic memories:

```sql
CREATE TABLE agent_memories (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,       -- Identifies who the memory belongs to (e.g., "Masum")
  content text not null,       -- The actual fact (e.g., "User lives in Dhaka")
  embedding vector(1536),      -- OpenAI's text-embedding-3-small format
  metadata jsonb,              -- Extra filtering data (e.g., {"category": "preference"})
  created_at timestamptz default now()
);
```

### Memory Logic: How it Works
1.  **Saving Memories (`add_memory` Tool):** We will add a new tool `add_memory(fact)` to `tools.js`. SARA's LLM will be instructed to use this tool whenever the user states a preference, fact, or instruction they want remembered. SARA actively *chooses* what to write down, which keeps the memory database clean and full of high-value facts.
2.  **Retrieving Memories (Vector RAG):** Every time the user connects or sends a message, `agent.js` will generate an embedding of their message/query and perform a Cosine Similarity Search on the `agent_memories` table. 
3.  **Prompt Injection:** The top 3 most relevant facts are silently injected into SARA's system context immediately before generating a reply (e.g., *System Override: Relevant retrieved memory: User lives in Dhaka*).

---

## 5. Implementation Roadmap

1.  **Phase 0: Proof-of-Concept Pipeline (COMPLETED)**
    *   [x] Establish persistent LiveKit Agent Worker (`agent.js`).
    *   [x] Integrate OpenAI for STT, LLM, and TTS.
    *   [x] Implement custom LLM Tools (Weather, Time, Web Search via custom DDG scraper).
2.  **Phase 1: Memory & State (NEXT STEPS)** 
    *   [ ] Set up Supabase project and `pgvector` tables.
    *   [ ] Integrate `@supabase/supabase-js` into `agent.js`.
    *   [ ] Create vector embedding functions and the `add_memory` tool.
    *   [ ] Implement the retrieval pipeline (RAG) upon user connection.
3.  **Phase 2: External Integrations**
    *   [ ] Email Integration (Read/Draft emails via SMTP/IMAP).
    *   [ ] Kanban / Task Management backend syncing.
4.  **Phase 3: Deployment**
    *   [ ] Dockerize the Agent Worker.
    *   [ ] Deploy the Worker to a persistent host (e.g., Render.com, Railway, or a VPS) so it runs 24/7 independently of your local machine.

---

## Open Questions for You

> [!IMPORTANT]
> Please review this updated plan.

1.  **Memory Strategy:** Should SARA proactively decide when to save a memory using an `add_memory` tool, or do you want the system to automatically summarize and save the entire conversation at the end of every session?
2.  **Supabase Setup:** Are you ready to proceed with Phase 1 (Memory)? If so, do you already have a Supabase project created, or should we script the SQL tables first?
