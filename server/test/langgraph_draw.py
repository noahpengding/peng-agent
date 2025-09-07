import os
import sys
dotenv_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "../../test/.env"
)
with open(dotenv_path, "r") as f:
    for line in f:
        if line.strip() and not line.startswith("#"):
            key, value = line.strip().split("=", 1)
            os.environ[key] = value

SCRIPT_DIR = os.path.dirname(os.path.realpath(__file__))
sys.path.append(os.path.dirname(SCRIPT_DIR + "../"))

from IPython.display import Image
from services.peng_agent import PengAgent

agent = PengAgent(
    user_name="test",
    model="gpt-4.1", 
    operater="openai",
    tools=["tavily_search_tool", "wikipedia_search_tool"],
)
agent = agent.init_agent_graph()

img = Image(agent.get_graph().draw_mermaid_png())
with open(f"peng_agent_2025_08_31.png", "wb") as f:
    f.write(img.data)