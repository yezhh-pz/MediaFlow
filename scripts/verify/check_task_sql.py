
import sqlite3
import os
from pathlib import Path

# Adjust path to where mediaflow.db is likely located
# settings.USER_DATA_DIR usually defaults to 'user_data' in the root
DB_PATH = Path("user_data/mediaflow.db")

def check_task(task_id):
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id, status, progress, message, error FROM task WHERE id = ?", (task_id,))
        row = cursor.fetchone()
        
        if row:
            print(f"Task ID: {row[0]}")
            print(f"Status: {row[1]}")
            print(f"Progress: {row[2]}")
            print(f"Message: {row[3]}")
            print(f"Error: {row[4]}")
        else:
            print(f"Task {task_id} not found.")
    except Exception as e:
        print(f"Error querying task: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_task("f84cfef7")
