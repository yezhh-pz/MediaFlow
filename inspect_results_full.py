import asyncio
import json
from src.core.database import init_db, get_session_context
from src.models.task_model import Task
from sqlmodel import select
import logging

# Suppress SQLAlchemy logging
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

async def main():
    await init_db()
    async with get_session_context() as session:
        statement = select(Task).order_by(Task.created_at.desc()).limit(3)
        result = await session.execute(statement)
        tasks = result.scalars().all()
        
        for t in tasks:
            print(f"=== Task {t.id} ({t.type}) ===")
            print(f"Name: {t.name}")
            if t.result:
                print(f"Result Files: {json.dumps(t.result.get('files', []), indent=2)}")
                print(f"Result Meta: {json.dumps(t.result.get('meta', {}), indent=2)}")
            if t.request_params:
                print(f"Request Params: {t.request_params}")
            print("\n")

if __name__ == "__main__":
    asyncio.run(main())
