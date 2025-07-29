import os
import sys
from dotenv import load_dotenv
from services.chat_models.openai_response import CustomOpenAIResponse
from services.tools.search_tools import tavily_search_tool

# from services.rag_tools import rag_usage_tool
# from services.web_page_tools import requests_tools
# from services.smtp_tools import email_send_tool
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage

# Load environment variables from .env file
dotenv_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "../../test/.env"
)
load_dotenv(dotenv_path)

SCRIPT_DIR = os.path.dirname(os.path.realpath(__file__))
sys.path.append(os.path.dirname(SCRIPT_DIR + "../"))


tools = [tavily_search_tool]

'''
llm_with_tools = llm.bind_tools(tools)

agent = create_react_agent(
    model=llm,
    tools=tools,
)

# input_prompt = {"messages": [HumanMessage(content="I'm Tena Walcott. SVP and Chief Actuarial of Valida Life Canada. Yesterday we had a nice dinner with Yipeng Ding and his team. We discussed a lot about AI in life insruance and evaluation process. Send an email to dingyipeng@dingyipeng.com about yesterday's dinner for thanks and looking forward to the next coorperation.")],}
input_prompt = {
    "messages": [
        HumanMessage(
            content="Who win the third place of the 2025 F1 British Grand Prix"
        )
    ],
}

for chunk in agent.stream(input_prompt):
    print("--" * 20)
    if chunk:
        if hasattr(chunk, "agent"):
            print(chunk.agent.messages[0].content, end="", flush=True)
        elif hasattr(chunk, "tools"):
            print(chunk.tools[0].result.content, end="", flush=True)
            '''
