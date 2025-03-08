import pika
from config.config import config
from utils.log import output_log

class RabbitMQConsumer:
    def __init__(self, group_id, exchange:str = config.rabbitmq_exchangedefault):
        self.exchange = exchange
        self.group_id = group_id
        output_log(f"RabbitMQConsumer: {self.exchange} with {config.rabbitmq_url}", 'debug')
        self.connection = pika.BlockingConnection(pika.URLParameters(config.rabbitmq_url))
        self.channel = self.connection.channel()

        self.channel.exchange_declare(
            exchange=self.exchange,
            exchange_type='fanout',
            durable=True
        )
        self.channel.queue_declare(
            queue=self.exchange,
            durable=True
        )
        self.channel.queue_bind(
            exchange=self.exchange,
            queue=self.exchange
        )
        self.channel.basic_qos(prefetch_count=1)

    def check_message(self, callback):
        method_frame, header_frame, body = self.channel.basic_get(queue=self.exchange)
        if method_frame:
            try:
                self.channel.basic_ack(delivery_tag=method_frame.delivery_tag)
                return callback(body)
            except Exception as e:
                output_log(f"Error in message consumpting: {e} | {body}", 'error')
                return None
        else:
            output_log(f"No message in queue {self.exchange}", 'info')
        self.close()

    def close(self):
        self.channel.stop_consuming()
        self.connection.close()
