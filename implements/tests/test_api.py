import os
import sys
import time
import requests
import threading
import uvicorn
from contextlib import contextmanager
from multiprocessing import Process

# 모듈 경로
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))
from api.main import app

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")

def test_api():
    test_db = "test_api_codemonitor.db"
    os.environ["CODEMONITOR_DB"] = test_db
    
    # 기존 파일 삭제
    if os.path.exists(test_db):
        os.remove(test_db)
        
    print("1. Starting API server in background...")
    server_process = Process(target=run_server)
    server_process.start()
    
    # 서버 준비 대기
    time.sleep(2)
    
    base_url = "http://127.0.0.1:8000"
    repo_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
    
    try:
        print("2. Testing GET /api/repos...")
        res = requests.get(f"{base_url}/api/repos")
        print(f"   Status: {res.status_code}, Response: {res.json()}")
        
        print(f"\n3. Testing POST /api/repos (Adding current repo: {repo_path})...")
        res = requests.post(f"{base_url}/api/repos", json={"name": "CodeMonitor Test", "path": repo_path})
        print(f"   Status: {res.status_code}, Response: {res.json()}")
        
        task_id = res.json().get("task_id")
        
        print("\n4. Polling Task Status...")
        for _ in range(5):
            res = requests.get(f"{base_url}/api/tasks/{task_id}")
            status_data = res.json()
            print(f"   Task Status: {status_data['status']}, Progress: {status_data.get('progress_commits', 0)}")
            if status_data['status'] == 'COMPLETED':
                print(f"   Task finished successfully. Total Commits: {status_data.get('total_commits')}")
                break
            time.sleep(1)
            
        print("\n5. Testing GET /api/stats...")
        res = requests.get(f"{base_url}/api/stats?days=7")
        stats_data = res.json()
        print(f"   Returned datasets count: {len(stats_data.get('datasets', []))}")
        if stats_data.get("datasets"):
             print(f"   First dataset label: {stats_data['datasets'][0]['label']}, data points: {len(stats_data['datasets'][0]['data'])}")
             
    except Exception as e:
        print(f"Test failed with error: {e}")
    finally:
        print("\n6. Shutting down server...")
        server_process.terminate()
        server_process.join()
        if os.path.exists(test_db):
            os.remove(test_db)
        print("Done.")

if __name__ == "__main__":
    test_api()
