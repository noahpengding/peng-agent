"""
title: Peng-chat
author: NDP
description: peng-chat rag system template function
requirements: pika,uuid
"""

from pydantic import BaseModel, Field
from typing import Dict, Any
from open_webui.models.users import Users
import pika
import uuid
import json
import time


class Pipe:
    class Valves(BaseModel):
        MODEL_ID: str = Field(default="llama3.2")
        EMBEDDING_MODEL: str = Field(default="nomic-embed-text")
        COLLECTION_NAME: str = Field(default="actsc")
        RABBITMQ_URL: str = Field(default="amqp://peng-bot:1XbVw0R2lS2eUNvuXt2Z@rabbitmq:5672/")

    def __init__(self):
        self.valves = self.Valves()
        self.connection = pika.BlockingConnection(pika.URLParameters(self.valves.RABBITMQ_URL))
        self.channel = self.connection.channel()

    def publish(self, message: Dict[str, Any], exchange, channel, user):
        self.channel.exchange_declare(
            exchange=exchange,
            exchange_type='fanout', 
            durable=True
        )
        body = {
            "ID": str(uuid.uuid4()),
            "Topic": exchange,
            "Data": message,
            "Channel": channel,
            "User": user
        }
        self.channel.basic_publish(
            exchange=body["Topic"], 
            routing_key='', 
            body=json.dumps(body),
            properties=pika.BasicProperties(
                delivery_mode=2,
                message_id=body["ID"],
                content_type='application/json'
            )
        )

    def check_message(self):
        method_frame, header_frame, body = self.channel.basic_get(queue=self.queue_name)
        if method_frame:
            try:
                self.channel.basic_ack(delivery_tag=method_frame.delivery_tag)
                body = json.loads(body.decode("utf-8"))
                return body
            except Exception as e:
                return None

    def pipe(self, body: dict, __user__: dict):
        user = Users.get_user_by_id(__user__["id"])
        self.publish(
            message={
                "sources": "openwebui",
                "type": "chat",
                "operator": "rag",
                "file_path": "",
                "message": f"collection={self.valves.COLLECTION_NAME} model={self.valves.MODEL_ID} embedding={self.valves.EMBEDDING_MODEL} {body["messages"][-1]["content"]}"
            },
            exchange="chat",
            channel="chat",
            user=user.name
        )
        times = 30
        while times > 0:
            times -= 1
            response = self.check_message()
            if response:
                return response
            time.sleep(10)
