from langgraph.prebuilt import create_react_agent


class Agent:
    def __init__(self, base_model, user_name="default", tool_list=None):
        self.user_name = user_name
        self.tool_list = tool_list if tool_list else []
        self.llm = base_model
        self.setup()

    def setup(self):
        self.agent = create_react_agent(self.llm, self.tool_list)
