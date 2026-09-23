

from dotenv import load_dotenv

from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions, ChatContext
from livekit.plugins import (
    noise_cancellation,
)
from livekit.plugins import google
from prompts import AGENT_INSTRUCTION, SESSION_INSTRUCTION
from tools import get_weather, search_web, send_email
from mem0 import AsyncMemoryClient
import os
import json
import logging
load_dotenv()


class Assistant(Agent):
    def __init__(self, chat_ctx=None) -> None:
        super().__init__(
            instructions=AGENT_INSTRUCTION,
            llm=google.beta.realtime.RealtimeModel(
            voice="Aoede",
            temperature=0.8,
        ),
            tools=[
                get_weather,
                search_web,
                send_email
            ],
            chat_ctx=chat_ctx

        )
        


async def entrypoint(ctx: agents.JobContext):
    
    # Memory functionality with graceful fallback
    mem0_client = None
    initial_ctx = ChatContext()
    initial_memory_ids = set()
    
    try:
        # Initialize Mem0 client if credentials are available
        api_key = os.getenv("MEM0_API_KEY")
        project_id = os.getenv("MEM0_PROJECT_ID")
        org_id = os.getenv("MEM0_ORG_ID")
        
        if api_key and project_id and org_id:
            logging.info("Initializing Mem0 memory client...")
            mem0_client = AsyncMemoryClient(
                api_key=api_key,
                project_id=project_id,
                org_id=org_id
            )
            
            # Try to retrieve existing memories
            user_name = 'Masum'
            results = await mem0_client.get_all(user_id=user_name)
            
            if results:
                memories = [
                    {
                        "memory": result["memory"],
                        "updated_at": result["updated_at"]
                    }
                    for result in results
                ]
                memory_str = json.dumps(memories)
                logging.info(f"Retrieved {len(results)} memories from Mem0")
                
                # Add to context and store IDs
                msg = initial_ctx.add_message(
                    role="assistant",
                    content=f"The user's name is {user_name}, and this is relevant context about him: {memory_str}."
                )
                initial_memory_ids.add(msg.id)
            else:
                logging.info("No existing memories found")
        else:
            logging.info("Mem0 credentials not available, continuing without memory")
            
    except Exception as e:
        logging.warning(f"Failed to initialize or retrieve memories: {e}. Continuing without memory.")
        mem0_client = None

    # Shutdown hook for saving memories
    async def save_memories_on_shutdown():
        if mem0_client is None:
            return
            
        try:
            # Get the chat context from the session
            chat_ctx = session.agent.chat_ctx
            messages_to_save = []
            
            for item in chat_ctx.items:
                # Skip messages that were part of the initial memory load
                if item.id in initial_memory_ids:
                    continue
                
                # Ensure content is a string
                content_str = ''.join(item.content) if isinstance(item.content, list) else str(item.content)
                
                if item.role in ['user', 'assistant']:
                    messages_to_save.append({
                        "role": item.role,
                        "content": content_str.strip()
                    })
            
            if messages_to_save:
                await mem0_client.add(messages_to_save, user_id="Masum")
                logging.info(f"Saved {len(messages_to_save)} new messages to memory")
            
        except Exception as e:
            logging.warning(f"Failed to save memories on shutdown: {e}")

    session: AgentSession[Assistant] = AgentSession()

    await session.start(
        room=ctx.room,
        agent=Assistant(chat_ctx=initial_ctx),
        room_input_options=RoomInputOptions(
            # LiveKit Cloud enhanced noise cancellation
            # - If self-hosting, omit this parameter
            # - For telephony applications, use `BVCTelephony` for best results
            video_enabled=True,
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )

    await ctx.connect()

    await session.generate_reply(
        instructions=SESSION_INSTRUCTION,
    )
    
    # Add shutdown callback for saving memories
    if mem0_client is not None:
        ctx.add_shutdown_callback(save_memories_on_shutdown)


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))







