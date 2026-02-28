# Module Spec: DataPersistence

## 1. 개요 (Overview)
이 모듈은 다중 Git 저장소 정보와 각 저장소의 시계열 라인수(LOC) 데이터를 안정적으로 저장하고 관리합니다. 대규모 데이터를 효율적으로 조회하기 위한 스키마 설계와 대량 데이터 삽입 최적화에 중점을 둡니다.

## 2. 데이터베이스 스키마 (Database Schema)

### 2.1. `repositories` 테이블
각 모니터링 대상 저장소의 정보를 관리합니다.
- `id`: INTEGER, PRIMARY KEY, AUTOINCREMENT
- `name`: TEXT, UNIQUE, NOT NULL (저장소 별칭)
- `path`: TEXT, NOT NULL (로컬 디렉토리 실제 경로)
- `status`: TEXT (예: 'idle', 'backfilling', 'error')
- `last_scanned_at`: DATETIME
- `created_at`: DATETIME, DEFAULT CURRENT_TIMESTAMP

### 2.3. `settings` 테이블 (Global Settings)
앱의 전역 설정값을 Key-Value 형태로 저장합니다.
- `key`: TEXT, PRIMARY KEY (예: 'scan_interval', 'global_extensions')
- `value`: TEXT, NOT NULL
- `updated_at`: DATETIME, DEFAULT CURRENT_TIMESTAMP

### 2.2. `history` 테이블
저장소별 시간에 따른 라인수 데이터를 저장합니다.
- `id`: INTEGER, PRIMARY KEY, AUTOINCREMENT
- `repo_id`: INTEGER, FOREIGN KEY REFERENCES repositories(id)
- `timestamp`: DATETIME, NOT NULL (커밋 날짜 또는 스캔 시점)
- `commit_hash`: TEXT (Git 커밋 해시)
- `total_loc`: INTEGER, NOT NULL (해당 시점의 총 라인수)

## 3. 최적화 및 인덱싱 (Optimization & Indexing)

### 3.1. 인덱스 설계
- **조회 최적화**: 그래프 렌더링 시 `repo_id`와 `timestamp`를 기준으로 정렬하여 조회하는 경우가 많으므로 복합 인덱스를 생성합니다.
  - `CREATE INDEX idx_history_repo_time ON history(repo_id, timestamp);`
- **중복 방지**: 동일 저장소의 동일 커밋이 중복 저장되지 않도록 유니크 인덱스를 생성합니다.
  - `CREATE UNIQUE INDEX idx_history_repo_commit ON history(repo_id, commit_hash);`

### 3.2. 성능 전략 (Performance Strategy)
- **Bulk Insert**: 히스토리 백필(Backfill) 시 수천 개 이상의 레코드가 한 번에 생성될 수 있습니다. 매번 `COMMIT` 하지 않고 `executemany`를 사용하여 트랜잭션 단위(예: 500개 단위)로 처리합니다.
- **Connection Pool**: 백그라운드 워커와 API 서버가 동시에 DB에 접근하므로, SQLite의 `WAL (Write-Ahead Logging)` 모드를 활성화하여 동시성 성능을 높입니다.

## 4. 인터페이스 정의 (Interface)

### 4.1. `RepositoryManager` 클래스
- `add_repository(name: str, path: str)` -> `int`
- `get_all_repositories()` -> `List[Dict]`
- `update_status(repo_id: int, status: str)`

### 4.2. `HistoryManager` 클래스
- `add_history_batch(repo_id: int, records: List[Dict])`
  - `[{'timestamp': ..., 'commit_hash': ..., 'total_loc': ...}, ...]` 형태의 데이터를 벌크 삽입.
- `get_stats(repo_ids: List[int], start_date: datetime, end_date: datetime)` -> `List[Dict]`
  - 특정 기간의 데이터를 조회하여 프론트엔드 차트용 데이터로 반환.
