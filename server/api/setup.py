from models.db_models import Base, create_db_engine
from utils.log import output_log
from config.config import config


def set_up():
    """Initialize database tables using SQLAlchemy ORM models"""
    try:
        output_log("Initiallizing", "info")
        engine = create_db_engine()
        output_log("Creating database tables...", "info")
        Base.metadata.create_all(engine)
        output_log("Database tables created successfully using SQLAlchemy", "info")
        # setup_redis_cache()
        # output_log("Redis cache setup completed", "info")
    except Exception as e:
        output_log(f"Error creating database tables: {e}", "error")
        raise

    phoenix_setup()


def phoenix_setup():
    from phoenix.otel import register

    output_log("Setting up Phoenix APM integration...", "info")
    register(
        project_name=config.phoenix_project,
        endpoint=config.phoenix_endpoint,
        auto_instrument=True,
    )
