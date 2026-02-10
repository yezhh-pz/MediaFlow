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
        
        with open("db_dump.txt", "w", encoding="utf-8") as f:
            for t in tasks:
                f.write(f"=== Task {t.id} ({t.type}) ===\n")
                f.write(f"Name: {t.name}\n")
                if t.result:
                    files = t.result.get('files', [])
                    meta = t.result.get('meta', {})
                    f.write(f"Result Files: {json.dumps(files, indent=2)}\n")
                    f.write(f"Result Meta: {json.dumps(meta, indent=2)}\n")
                else:
                    f.write("Result: None\n")
                    
                if t.request_params:
                     f.write(f"Request Params: {json.dumps(t.request_params, indent=2)}\n")
                f.write("\n" + "="*40 + "\n\n")

if __name__ == "__main__":
    asyncio.run(main())
