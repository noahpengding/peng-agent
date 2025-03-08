import pika
import json
import uuid
from typing import Dict, Any
from config.config import config
from utils.log import output_log

class RabbitMQPublisher:
    def __init__(self):
        output_log(f"RabbitMQPublisher: {config.rabbitmq_url}", 'debug')
        self.connection = pika.BlockingConnection(pika.URLParameters(config.rabbitmq_url))
        self.channel = self.connection.channel()
        
    def publish(self, message: Dict[str, Any], exchange: str = config.rabbitmq_exchangeout, channel = config.rabbitmq_exchangedefault, user="default"):
        self.channel.exchange_declare(
            exchange=exchange,
            exchange_type='fanout', 
            durable=True
        )
        self.channel.queue_declare(queue=exchange, durable=True)
        self.channel.queue_bind(exchange=exchange, queue=exchange)
        body = {
            "ID": str(uuid.uuid4()),
            "Topic": exchange,
            "Data": message,
            "Channel": channel,
            "User": user
        }
        output_log(f"Publishing message: {body}", 'debug')
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
    
    def close(self):
        self.connection.close()