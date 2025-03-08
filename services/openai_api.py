from openai import OpenAI
import openai
from config.config import config
from utils.log import output_log
from utils.mysql_connect import MysqlConnect
from datetime import datetime, timedelta

class OpenAIHandler:
    _instances = {}
    
    def __new__(cls, user_id="admin"):
        if user_id in cls._instances:
            return cls._instances[user_id]
        instance = super().__new__(cls)
        cls._instances[user_id] = instance
        return instance
    
    def __init__(self, user_id="admin"):
        if not hasattr(self, "user_id"):
            self.user_id = user_id
            self.client = OpenAI(
                api_key=config.openai_api_key,
                organization=config.openai_organization_id, 
                project=config.openai_project_id)
            self.start_prompt = config.start_prompt
            self.conversation = [{"role": "user", "content": self.start_prompt}]
            self.model_id = "gpt-4o-mini"
            self.image_model_id = "dall-e-3"
            self.max_completion_tokens = 5000

    def list_models(self):
        response = self.client.models.list()
        models = [model.id for model in response.data]
        return "\n".join(models)
    
    def list_parameters(self):
        return f'''
        model_id: {self.model_id}
        image_model_id: {self.image_model_id}
        max_completion_tokens: {self.max_completion_tokens}
        '''
    
    def set_parameters(self, name, value) -> str:
        if name == "model_id" or name == "model":
            self.model_id = str(value)
            return f"Model set to {self.model_id}"
        elif name == "image_model_id" or name == "image_model":
            self.image_model_id = str(value)
            return f"Image model set to {self.image_model_id}"
        elif name == "max_completion_tokens":
            self.max_completion_tokens = int(value)
            return f"Max completion tokens set to {self.max_completion_tokens}"
        elif name == "prompt":
            self.start_prompt = str(value)
            self.conversation = [{"role": "user", "content": self.start_prompt}]
            return f"Prompt set to {self.start_prompt}"
        elif name == "conversation":
            self.conversation = list(value)
            return f"Conversation set to {self.conversation}"
        else:
            output_log(f"Invalid parameter: {name}", "error")
            return f"Invalid parameter: {name}, {value}"

    def chat_completion(self, messages, base64_images=[]):
        user_message = {
            "role": "user",
            "content": [{"type": "text", "text": messages}]
        }

        if base64_images != []:
            if self.model_id.startswith("o1"):
                self.model_id = "gpt-4o-mini"
            for base64_image in base64_images:
                user_message["content"].append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                })
        self.conversation.append(user_message)
        response = self.create_chat_completion()
        mysql = MysqlConnect()
        mysql.create_record(
            "chat",
            {
                "user_name": self.user_id,
                "base_model": self.model_id,
                "embedding_model": "openai",
                "human_input": messages,
                "ai_response": response[:2048] if len(response) > 2048 else response,
                "knowledge_base": "openai",
                "created_at": datetime.now(),
                "expire_at": datetime.now() + timedelta(days=7)
            }
        )
        return response

    def create_chat_completion(self):
        response = self.client.chat.completions.create(
            model=self.model_id,
            messages=self.conversation,
            max_completion_tokens=self.max_completion_tokens,
        )
        generate_message = response.choices[0].message.content
        self.conversation.append({"role": "assistant", "content": generate_message})
        return generate_message
    
    def image_generation(self, messages, size="1024x1024"):
        response = self.client.images.generate(
            model=self.image_model_id,
            prompt=messages,
            size=size,
            n=1
        )
        return response.data[0].url
    
    def get_conversations(self):
        output_log("Getting conversions", "debug")
        return self.conversation

    def end_conversation(self):
        self.conversation = [{"role": "user", "content": self.start_prompt}]
