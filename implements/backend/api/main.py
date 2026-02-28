import sys
import os
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# 모듈 경로 추가 (backend 디렉토리 기준 실행 가정)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

from db.database import DatabaseConnection
from db.managers import RepositoryManager, HistoryManager, SettingsManager
from core.worker import get_worker

app = FastAPI(title="CodeMonitor API")

# CORS 설정 (Vite 프론트엔드 연동)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발용 (실제 배포 시 특정 도메인 제한 필요)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 의존성 주입용 DB 컨텍스트
DB_PATH = os.environ.get("CODEMONITOR_DB", "codemonitor.db")
db_conn = DatabaseConnection(DB_PATH)
worker = get_worker(DB_PATH)

def get_repo_manager():
    return RepositoryManager(db_conn)

def get_history_manager():
    return HistoryManager(db_conn)

def get_settings_manager():
    return SettingsManager(db_conn)

# --- Models ---

class RepoCreate(BaseModel):
    name: str
    path: str
    include_path: Optional[str] = None

class SettingsUpdate(BaseModel):
    key: str
    value: str

# --- Routes ---

@app.get("/api/repos")
def list_repositories(repo_mgr: RepositoryManager = Depends(get_repo_manager)):
    """등록된 모든 저장소 목록과 상태 반환"""
    repos = repo_mgr.get_all_repositories()
    return {"repositories": repos}

@app.post("/api/repos")
def add_repository(
    repo: RepoCreate, 
    repo_mgr: RepositoryManager = Depends(get_repo_manager)
):
    """새로운 Git 저장소 등록 및 백필 작업 시작"""
    if not os.path.exists(os.path.join(repo.path, ".git")):
        raise HTTPException(status_code=400, detail="Provided path is not a valid Git repository.")

    repo_id = repo_mgr.add_repository(repo.name, repo.path, repo.include_path)
    
    # 워커에 작업 위임 (백그라운드 스레드에서 시작)
    # 실제로는 BackgroundTasks를 써도 되지만 worker 내부에서 스레드 관리 중
    task_id = worker.start_backfill(repo_id, repo.path, repo.include_path)
    
    return {
        "message": "Repository added and backfill started.",
        "repo_id": repo_id,
        "task_id": task_id
    }

@app.get("/api/stats")
def get_statistics(
    repo_ids: Optional[str] = Query(None, description="Comma-separated repo IDs or 'all'"),
    days: int = Query(30, description="Fetch history for the last N days"),
    history_mgr: HistoryManager = Depends(get_history_manager),
    repo_mgr: RepositoryManager = Depends(get_repo_manager)
):
    """그래프 렌더링을 위한 시계열 통계 데이터 반환"""
    all_repos = {r['id']: r['name'] for r in repo_mgr.get_all_repositories()}
    
    target_ids = []
    if repo_ids == 'all' or not repo_ids:
        target_ids = list(all_repos.keys())
    else:
        try:
            target_ids = [int(rid.strip()) for rid in repo_ids.split(',')]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid repo_ids format")

    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    start_str = start_date.strftime("%Y-%m-%d 00:00:00")
    end_str = end_date.strftime("%Y-%m-%d 23:59:59")
    
    raw_stats = history_mgr.get_stats(target_ids, start_str, end_str)
    
    # 프론트엔드가 사용하기 쉬운 형태로 변환 (Dataset 형태로 그룹화)
    datasets = {}
    for stat in raw_stats:
        rid = stat['repo_id']
        repo_name = all_repos.get(rid, f"Repo {rid}")
        
        if repo_name not in datasets:
            datasets[repo_name] = {"label": repo_name, "data": []}
            
        datasets[repo_name]["data"].append({
            "x": stat['timestamp'],
            "y": stat['total_loc']
        })

    return {"datasets": list(datasets.values())}

@app.get("/api/tasks/{task_id}")
def get_task_status(task_id: str):
    """특정 작업(백필) 상태 조회"""
    status = worker.get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Task not found")
    return status

@app.get("/api/settings")
def get_settings(settings_mgr: SettingsManager = Depends(get_settings_manager)):
    """전역 설정 반환 (예: theme)"""
    # 실제로는 전체 목록을 가져오는 메서드가 필요하지만 임시로 단일 키 조회
    theme = settings_mgr.get_value("theme", "dark")
    return {"theme": theme}

@app.patch("/api/settings")
def update_settings(
    setting: SettingsUpdate,
    settings_mgr: SettingsManager = Depends(get_settings_manager)
):
    """설정값 업데이트 (Upsert)"""
    settings_mgr.set_value(setting.key, setting.value)
    return {"message": "Setting updated"}

if __name__ == "__main__":
    import uvicorn
    # 환경 변수에서 포트 가져오기 (기본값 8000)
    port = int(os.environ.get("PORT", 8000))
    # 테스트 및 개발용 서버 실행: python implements/backend/api/main.py
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
