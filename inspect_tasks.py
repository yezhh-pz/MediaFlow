import asyncio
from src.core.database import init_db, get_session_context
from src.models.task_model import Task
from sqlmodel import select

async def main():
    await init_db()
    async with get_session_context() as session:
        statement = select(Task).order_by(Task.created_at.desc()).limit(5)
        result = await session.execute(statement)
        tasks = result.scalars().all()
        
        print(f"{'ID':<10} {'Type':<10} {'Name':<50}")
        print("-" * 80)
        for t in tasks:
            print(f"{t.id:<10} {t.type:<10} {t.name[:45]:<50}")
            if t.type == "translate":
                print(f"  > Params: {t.request_params}")

if __name__ == "__main__":
    asyncio.run(main())
