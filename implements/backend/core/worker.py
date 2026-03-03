import threading
import uuid
import time
from typing import Dict, Any, Optional
from datetime import datetime

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

from core.git_analyzer import GitAnalyzer
from db.database import DatabaseConnection
from db.managers import HistoryManager, RepositoryManager

class TaskState:
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class BackfillWorker:
    """백그라운드에서 저장소의 전체 히스토리를 스캔하는 워커 클래스"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._tasks: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def _update_task(self, task_id: str, **kwargs):
        with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id].update(kwargs)

    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._tasks.get(task_id)

    def start_backfill(self, repo_id: int, repo_path: str, include_path: Optional[str] = None) -> str:
        task_id = str(uuid.uuid4())
        
        with self._lock:
            self._tasks[task_id] = {
                "task_id": task_id,
                "repo_id": repo_id,
                "include_path": include_path,
                "status": TaskState.PENDING,
                "progress_commits": 0,
                "total_commits": 0, # 전체 개수를 미리 알기 어려우므로 진행 중 업데이트
                "error": None,
                "started_at": datetime.now().isoformat()
            }

        thread = threading.Thread(
            target=self._run_backfill_process,
            args=(task_id, repo_id, repo_path, include_path),
            daemon=True
        )
        thread.start()
        
        return task_id

    def _run_backfill_process(self, task_id: str, repo_id: int, repo_path: str, include_path: Optional[str] = None):
        self._update_task(task_id, status=TaskState.RUNNING)
        
        try:
            # DB 연결은 스레드 내에서 독립적으로 생성
            db = DatabaseConnection(self.db_path)
            repo_manager = RepositoryManager(db)
            history_manager = HistoryManager(db)
            
            repo_manager.update_status(repo_id, "backfilling")

            analyzer = GitAnalyzer(repo_path, include_path)
            
            # 여기서 cloc를 통한 초기(가장 첫 커밋 직전 상태) 베이스라인 측정을 생략하고,
            # 단순히 0에서 시작하여 insertions/deletions 만으로 계산.
            # (보다 정밀하게 하려면 cloc과 혼합해야 하지만 성능을 위해 로그 기반 누적 계산)
            
            current_loc = 0
            batch_records = []
            BATCH_SIZE = 500
            processed_commits = 0

            for commit in analyzer.get_commits_generator():
                current_loc += commit['insertions']
                current_loc -= commit['deletions']
                
                # 음수가 나오지 않도록 보정
                current_loc = max(0, current_loc)

                batch_records.append({
                    "timestamp": commit['date'],
                    "commit_hash": commit['hash'],
                    "total_loc": current_loc
                })
                
                processed_commits += 1
                
                if len(batch_records) >= BATCH_SIZE:
                    history_manager.add_history_batch(repo_id, batch_records)
                    batch_records = []
                    self._update_task(task_id, progress_commits=processed_commits)
                    
            # 남은 레코드 처리
            if batch_records:
                history_manager.add_history_batch(repo_id, batch_records)
                self._update_task(task_id, progress_commits=processed_commits)

            # 완료 상태 업데이트
            repo_manager.update_status(repo_id, "idle")
            repo_manager.update_last_scanned(repo_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            self._update_task(
                task_id, 
                status=TaskState.COMPLETED, 
                completed_at=datetime.now().isoformat(),
                total_commits=processed_commits
            )

        except Exception as e:
            print(f"Backfill Worker Error [{task_id}]: {e}")
            self._update_task(task_id, status=TaskState.FAILED, error=str(e))
            
            # DB에도 에러 상태 반영 시도
            try:
                db = DatabaseConnection(self.db_path)
                repo_manager = RepositoryManager(db)
                repo_manager.update_status(repo_id, "error")
            except Exception:
                pass

    def start_sync(self, repo_id: int, repo_path: str, include_path: Optional[str] = None):
        """저장소의 증분 업데이트(Sync) 시작"""
        thread = threading.Thread(
            target=self._run_sync_process,
            args=(repo_id, repo_path, include_path),
            daemon=True
        )
        thread.start()

    def _run_sync_process(self, repo_id: int, repo_path: str, include_path: Optional[str] = None):
        try:
            db = DatabaseConnection(self.db_path)
            repo_manager = RepositoryManager(db)
            history_manager = HistoryManager(db)
            
            analyzer = GitAnalyzer(repo_path, include_path)
            
            # 1. Git Pull
            if not analyzer.pull():
                print(f"Sync Failed: git pull failed for repo {repo_id}")
                return

            # 2. 마지막 레코드 가져오기
            last_record = history_manager.get_last_history_record(repo_id)
            if not last_record:
                # 레코드가 없으면 백필부터 시작하도록 안내하거나 무시
                print(f"Sync Skipped: No history found for repo {repo_id}")
                return

            last_hash = last_record['commit_hash']
            current_loc = last_record['total_loc']

            # 3. 마지막 해시 이후의 커밋만 분석
            batch_records = []
            processed_commits = 0
            
            # get_commits_generator에 since_hash 전달 (incremental)
            for commit in analyzer.get_commits_generator(since_hash=last_hash):
                current_loc += commit['insertions']
                current_loc -= commit['deletions']
                current_loc = max(0, current_loc)

                batch_records.append({
                    "timestamp": commit['date'],
                    "commit_hash": commit['hash'],
                    "total_loc": current_loc
                })
                processed_commits += 1

            if batch_records:
                history_manager.add_history_batch(repo_id, batch_records)
                print(f"Sync Completed: {processed_commits} new commits for repo {repo_id}")
            else:
                print(f"Sync: No new commits since {last_hash} for repo {repo_id}")

            repo_manager.update_last_scanned(repo_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

        except Exception as e:
            print(f"Sync Worker Error [repo {repo_id}]: {e}")

class MidnightScheduler:
    """매일 밤 12시에 모든 저장소를 동기화하는 스케줄러"""
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._stop_event = threading.Event()

    def start(self):
        thread = threading.Thread(target=self._run_loop, daemon=True)
        thread.start()
        print("Midnight Scheduler Started.")

    def _run_loop(self):
        while not self._stop_event.is_set():
            now = datetime.now()
            # 매일 00:00에 실행
            if now.hour == 0 and now.minute == 0:
                print(f"[{now}] Midnight Sync Started...")
                self._execute_sync()
                # 61초 대기하여 같은 분에 중복 실행 방지
                time.sleep(61)
            else:
                # 30초마다 체크
                time.sleep(30)

    def _execute_sync(self):
        try:
            db = DatabaseConnection(self.db_path)
            repo_manager = RepositoryManager(db)
            worker = get_worker(self.db_path)
            
            repos = repo_manager.get_all_repositories()
            for repo in repos:
                print(f"Syncing {repo['name']} (Path: {repo['path']})...")
                worker.start_sync(repo['id'], repo['path'], repo['include_path'])
        except Exception as e:
            print(f"Scheduler Execution Error: {e}")

# 전역 워커와 스케줄러 인스턴스
_worker_instance = None
_scheduler_instance = None

def get_worker(db_path: str = "codemonitor.db") -> BackfillWorker:
    global _worker_instance
    if _worker_instance is None:
        _worker_instance = BackfillWorker(db_path)
    return _worker_instance

def start_midnight_scheduler(db_path: str = "codemonitor.db"):
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = MidnightScheduler(db_path)
        _scheduler_instance.start()
    return _scheduler_instance
