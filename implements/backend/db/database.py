import sqlite3
from contextlib import contextmanager
from typing import Generator

class DatabaseConnection:
    def __init__(self, db_path: str = "codemonitor.db"):
        self.db_path = db_path
        self._initialize_db()

    def _initialize_db(self):
        """데이터베이스 스키마 초기화 및 WAL 모드 설정"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 성능 향상을 위한 WAL 모드
            cursor.execute("PRAGMA journal_mode=WAL;")
            
            # repositories 테이블
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS repositories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    path TEXT NOT NULL,
                    include_path TEXT,
                    status TEXT DEFAULT 'idle',
                    last_scanned_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # history 테이블
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    repo_id INTEGER,
                    timestamp DATETIME NOT NULL,
                    commit_hash TEXT,
                    total_loc INTEGER NOT NULL,
                    FOREIGN KEY(repo_id) REFERENCES repositories(id)
                )
            ''')

            # settings 테이블
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # 인덱스 생성
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_repo_time ON history(repo_id, timestamp);")
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_history_repo_commit ON history(repo_id, commit_hash);")
            
            # 스키마 마이그레이션 로직 추가: 구버전 DB에 include_path 컬럼이 없는 경우 추가
            cursor.execute("PRAGMA table_info(repositories)")
            columns = [info[1] for info in cursor.fetchall()]
            if 'include_path' not in columns:
                cursor.execute("ALTER TABLE repositories ADD COLUMN include_path TEXT;")
                print("Database Migration: Added 'include_path' column to 'repositories' table.")

            conn.commit()

    @contextmanager
    def get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        """컨텍스트 매니저를 통한 안전한 커넥션 제공"""
        conn = sqlite3.connect(self.db_path)
        # 딕셔너리 형태로 결과를 받기 위해 row_factory 설정
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
