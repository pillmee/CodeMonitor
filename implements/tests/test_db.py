import sys
import os
from datetime import datetime

# 모듈 경로 추가
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from db.database import DatabaseConnection
from db.managers import RepositoryManager, HistoryManager, SettingsManager

def test_database():
    test_db_path = "test_codemonitor.db"
    
    # 기존 테스트 DB 삭제 (존재할 경우)
    if os.path.exists(test_db_path):
        os.remove(test_db_path)

    print("1. Initializing Database...")
    db = DatabaseConnection(test_db_path)
    
    repo_manager = RepositoryManager(db)
    history_manager = HistoryManager(db)
    settings_manager = SettingsManager(db)

    print("2. Testing RepositoryManager...")
    repo_id_1 = repo_manager.add_repository("Android Framework", "/path/to/android")
    repo_id_2 = repo_manager.add_repository("CodeMonitor", "/path/to/monitor")
    
    repos = repo_manager.get_all_repositories()
    print(f"   Registered Repos: {[r['name'] for r in repos]}")

    repo_manager.update_status(repo_id_1, "backfilling")
    print(f"   Updated Repo 1 Status: {repo_manager.get_all_repositories()[0]['status']}")

    print("3. Testing HistoryManager...")
    records = [
        {"timestamp": "2023-01-01 10:00:00", "commit_hash": "abc1234", "total_loc": 5000},
        {"timestamp": "2023-01-02 10:00:00", "commit_hash": "def5678", "total_loc": 5100},
        {"timestamp": "2023-01-03 10:00:00", "commit_hash": "ghi9012", "total_loc": 5050},
    ]
    history_manager.add_history_batch(repo_id_1, records)
    
    # 중복 해시 삽입 테스트 (IGNORE 동작 확인)
    records_dup = [{"timestamp": "2023-01-01 10:00:00", "commit_hash": "abc1234", "total_loc": 9999}]
    history_manager.add_history_batch(repo_id_1, records_dup)

    stats = history_manager.get_stats([repo_id_1], "2023-01-01", "2023-01-04")
    print(f"   Fetched {len(stats)} historical records for Repo 1")
    for stat in stats:
        print(f"      - {stat['timestamp']}: {stat['total_loc']} LOC")

    print("4. Testing SettingsManager...")
    settings_manager.set_value("theme", "dark")
    settings_manager.set_value("theme", "light") # update (upsert)
    val = settings_manager.get_value("theme")
    print(f"   Setting 'theme' = {val}")

    # 정리
    if os.path.exists(test_db_path):
        os.remove(test_db_path)
    print("\nTest finished successfully!")

if __name__ == "__main__":
    test_database()
