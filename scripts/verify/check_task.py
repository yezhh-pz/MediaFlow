
import sys
import os
sys.path.append(os.getcwd())
from backend.core.database import SessionLocal
from backend.models.task import Task

def check_task(task_id):
    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if task:
            print(f"Task ID: {task.id}")
            print(f"Name: {task.name}")
            print(f"Status: {task.status}")
            print(f"Progress: {task.progress}")
            print(f"Message: {task.message}")
            print(f"Result: {task.result}")
            print(f"Error: {task.error}")
        else:
            print(f"Task {task_id} not found.")
    finally:
        db.close()

if __name__ == "__main__":
    check_task("f84cfef7")
