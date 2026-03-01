from models.db_models import Base, create_db_engine
from utils.log import output_log
from config.config import config
from services.redis_service import setup_redis_cache


def set_up():
    """Initialize database tables using SQLAlchemy ORM models"""
    try:
        output_log("Initiallizing", "info")
        engine = create_db_engine()
        output_log("Creating database tables...", "info")
        Base.metadata.create_all(engine)
        output_log("Database tables created successfully using SQLAlchemy", "info")
        setup_redis_cache()
        output_log("Redis cache setup completed", "info")
    except Exception as e:
        output_log(f"Error creating database tables: {e}", "error")
        raise

    # phoenix_setup()
    dd_setup()


def phoenix_setup():
    from phoenix.otel import register

    output_log("Setting up Phoenix APM integration...", "info")
    register(
        project_name=config.phoenix_project,
        endpoint=config.phoenix_endpoint,
        batch=True,
        set_global_tracer_provider=False,
        auto_instrument=True,
    )

def dd_setup():
    from ddtrace.llmobs import LLMObs
    output_log("Setting up Datadog APM integration...", "info")

    LLMObs.enable(
        ml_app=config.app_name,
        api_key=config.dd_api_key,
        site=config.dd_site,
        agentless_enabled=True,
        service=config.dd_service,
        env=config.env,
    )
