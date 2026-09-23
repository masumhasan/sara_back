import { WorkerOptions, cli, defineAgent, llm, stt, Agent, AgentSession, AgentSessionEventTypes } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getWeather, searchWeb, getCurrentTime } from './tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Read prompt.json for agent instructions
const promptData = JSON.parse(fs.readFileSync(path.join(__dirname, 'prompt.json'), 'utf8'));
const agentInstruction = promptData.AGENT_INSTRUCTION;

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect();
    console.log('Connected to LiveKit room:', ctx.room.name);

    // 1. Voice Activity Detection (VAD)
    const vad = await silero.VAD.load();

    // 2. Speech-to-Text (STT) - OpenAI Whisper
    const baseStt = new openai.STT({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'whisper-1',
      useRealtime: false,
    });
    const streamingStt = new stt.StreamAdapter(baseStt, vad);

    // 3. Language Model (LLM) - OpenAI GPT-4o-mini
    const model = new openai.LLM({
      model: 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 4. Text-to-Speech (TTS) - OpenAI TTS
    const tts = new openai.TTS({
      model: 'tts-1',
      voice: 'nova',
      apiKey: process.env.OPENAI_API_KEY,
    });

    const agent = new Agent({
      instructions: agentInstruction,
      vad,
      stt: streamingStt,
      llm: model,
      tts,
      tools: [getWeather, searchWeb, getCurrentTime],
    });

    const session = new AgentSession({
      // Keep session alive even if user temporarily disconnects (enables reconnect + text-only)
      userAwayTimeout: null,
    });
    await session.start({
      agent,
      room: ctx.room,
      inputOptions: {
        // Don't kill session if user disconnects/reconnects
        closeOnDisconnect: false,
        // Handle incoming text/chat messages from the frontend
        textInputCallback: (sess, event) => {
          console.log('[SARA] Text received:', event.text);
          try {
            sess.generateReply({
              userInput: event.text,
              inputModality: 'text',
              allowInterruptions: false,
            });
            console.log('[SARA] generateReply initiated for:', event.text);
          } catch (err) {
            console.error('[SARA] Error calling generateReply:', err);
          }
        },
      },
    });

    // Log session errors
    session.on(AgentSessionEventTypes.Error, (ev) => {
      console.error('[SARA] Session error:', ev);
    });

    // Greet the participant once they are connected and subscribed
    let hasGreeted = false;
    const greetParticipant = async (identity) => {
      if (hasGreeted) return;
      hasGreeted = true;
      console.log(`[SARA] Participant ready: ${identity}. Sending single greeting...`);
      // Brief delay to let WebRTC audio tracks & data channel settle
      await new Promise((r) => setTimeout(r, 800));
      session.say("Hello! I'm SARA. How can I assist you today?");
    };

    // Wait for the first human participant (or immediate if already present)
    ctx.waitForParticipant().then((participant) => {
      greetParticipant(participant.identity);
    }).catch((err) => {
      console.error('[SARA] Error waiting for participant:', err);
    });

    // Also greet if the user disconnects/refreshes and reconnects
    ctx.room.on('participantDisconnected', () => {
      hasGreeted = false;
    });
    ctx.room.on('participantConnected', (participant) => {
      greetParticipant(participant.identity);
    });
  },
});

// Only run the CLI if executed directly (not when imported as a worker by the child runner process)
if (!process.send) {
  cli.runApp(new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    initializeProcessTimeout: 30 * 1000,
  }));
}
