import asyncio
import json
from src.core.database import init_db, get_session_context
from src.models.task_model import Task
from sqlmodel import select

async def main():
    await init_db()
    async with get_session_context() as session:
        statement = select(Task).order_by(Task.created_at.desc()).limit(5)
        result = await session.execute(statement)
        tasks = result.scalars().all()
        
        print(f"{'ID':<10} {'Type':<10}")
        print("-" * 80)
        for t in tasks:
            print(f"Task: {t.id} ({t.type})")
            if t.result:
                print(f"  Result: {json.dumps(t.result, indent=2)}")
            else:
                print("  Result: None")

if __name__ == "__main__":
    asyncio.run(main())
