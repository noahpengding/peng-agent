# Create server parameters for stdio connection
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
import asyncio
import os

from langchain_mcp_adapters.tools import load_mcp_tools

server_params = {
    "url": "http://192.168.31.68:8083/mcp",
}

dotenv_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "../../test/.env"
)
with open(dotenv_path, "r") as f:
    for line in f:
        if line.strip() and not line.startswith("#"):
            key, value = line.strip().split("=", 1)
            os.environ[key] = value

SCRIPT_DIR = os.path.dirname(os.path.realpath(__file__))


async def main():
    def _generate_prompt_params(message: str, image: str, chat_config: ChatConfig):
        import services.prompt_generator as prompt_generator

        prompt = prompt_generator.prompt_template(
            model_name=chat_config.base_model,
        )
        params = prompt_generator.base_prompt_generate(
            message=message,
            short_term_memory=chat_config.short_term_memory,
            long_term_memory=[],
        )
        params = prompt_generator.add_image_to_prompt(
            model_name=chat_config.base_model,
            params=params,
            image=image,
        )
        return prompt, params

    async with streamablehttp_client(**server_params) as (read, write, _):
        async with ClientSession(read, write) as session:
            # Initialize the connection
            await session.initialize()

            chat_config = ChatConfig(
                operator="openai",
                base_model="gpt-5",
                tools_name=[],
                short_term_memory=[],
            )

            prompt, params = _generate_prompt_params(
                "Use my traefik dashboard at traefik.tenawalcott.com to summary all my current HTTP routers with name, rule, entrypoint, SSL/TLS, service, and service url",
                "",
                chat_config,
            )
            # prompt, params = _generate_prompt_params("Use https://traefik.tenawalcott.com/api/http/routers to summary all my current HTTP routers with name, rule, entrypoint, SSL/TLS, service, and service url", "", chat_config)
            from services.peng_agent import PengAgent, AgentState

            # Load the remote graph as if it was a tool
            tools = await load_mcp_tools(session)
            """
            for tool in tools:
                if tool.name == "browser_navigate":
                    result = await tool.arun({"url": "https://traefik.tenawalcott.com/api/http/routers"})
                    print("Browser navigate result:", result)
"""
            agent = PengAgent(
                "test",
                chat_config.operator,
                chat_config.base_model,
                tools,
            )
            async for chunk in agent.astream(AgentState(prompt.invoke(params))):
                print(chunk, end="", flush=True)


if __name__ == "__main__":
    from models.chat_config import ChatConfig
    from api.setup import phoenix_setup

    phoenix_setup()
    asyncio.run(main())
