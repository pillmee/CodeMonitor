from typing import List, Dict, Any, Optional
from datetime import datetime
import sqlite3
from .database import DatabaseConnection

class RepositoryManager:
    def __init__(self, db: DatabaseConnection):
        self.db = db

    def add_repository(self, name: str, path: str) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(
                    "INSERT INTO repositories (name, path) VALUES (?, ?)", 
                    (name, path)
                )
                conn.commit()
                return cursor.lastrowid
            except sqlite3.IntegrityError:
                # 이미 존재하는 경우 ID 반환
                cursor.execute("SELECT id FROM repositories WHERE name = ?", (name,))
                return cursor.fetchone()['id']

    def get_all_repositories(self) -> List[Dict[str, Any]]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM repositories")
            return [dict(row) for row in cursor.fetchall()]

    def update_status(self, repo_id: int, status: str):
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE repositories SET status = ? WHERE id = ?",
                (status, repo_id)
            )
            conn.commit()

    def update_last_scanned(self, repo_id: int, scan_time: datetime):
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE repositories SET last_scanned_at = ? WHERE id = ?",
                (scan_time, repo_id)
            )
            conn.commit()

class HistoryManager:
    def __init__(self, db: DatabaseConnection):
        self.db = db

    def add_history_batch(self, repo_id: int, records: List[Dict[str, Any]]):
        """
        records: [{'timestamp': datetime/str, 'commit_hash': str, 'total_loc': int}, ...]
        벌크 인서트를 수행하며, 중복 커밋은 무시합니다.
        """
        if not records:
            return

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            # bulk insert
            batch_data = [
                (repo_id, rec['timestamp'], rec.get('commit_hash'), rec['total_loc'])
                for rec in records
            ]
            
            cursor.executemany(
                """
                INSERT OR IGNORE INTO history (repo_id, timestamp, commit_hash, total_loc)
                VALUES (?, ?, ?, ?)
                """,
                batch_data
            )
            conn.commit()

    def get_stats(self, repo_ids: List[int], start_date: str, end_date: str) -> List[Dict[str, Any]]:
        if not repo_ids:
            return []

        placeholders = ",".join("?" for _ in repo_ids)
        query = f"""
            SELECT repo_id, timestamp, total_loc 
            FROM history 
            WHERE id IN (
                SELECT MAX(id)
                FROM history 
                WHERE repo_id IN ({placeholders})
                  AND timestamp >= ? AND timestamp <= ?
                GROUP BY repo_id, SUBSTR(timestamp, 1, 10)
            )
            ORDER BY repo_id, timestamp ASC
        """
        params = repo_ids + [start_date, end_date]

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

class SettingsManager:
    def __init__(self, db: DatabaseConnection):
        self.db = db

    def set_value(self, key: str, value: str):
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO settings (key, value, updated_at) 
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET 
                    value=excluded.value, 
                    updated_at=CURRENT_TIMESTAMP
                """,
                (key, value)
            )
            conn.commit()

    def get_value(self, key: str, default: Optional[str] = None) -> Optional[str]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
            row = cursor.fetchone()
            return row['value'] if row else default
