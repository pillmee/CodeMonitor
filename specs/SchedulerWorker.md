# Module Spec: Scheduler & Worker

## 1. 개요 (Overview)
이 모듈은 시간이 오래 걸리는 작업(히스토리 백필)을 백그라운드에서 처리하고, 주기적으로 저장소를 스캔하여 최신 상태를 유지하는 역할을 담당합니다. 작업 진행 상태를 관리하여 사용자가 대시보드에서 분석 현황을 실시간으로 확인할 수 있게 합니다.

## 2. 주요 기능 (Key Functions)

### 2.1. 히스토리 백필 워커 (Backfill Worker)
- **작동 방식**: 저장소가 새로 등록되면 `GitAnalyzer`와 `DataPersistence` 모듈을 사용하여 첫 커밋부터의 히스토리를 생성합니다.
- **상태 관리**: 전체 커밋 수 대비 현재 처리된 커밋 수를 계산하여 `progress_percentage`를 업데이트합니다.
- **동시성 제어**: 동일한 저장소에 대해 여러 백필 작업이 중복 실행되지 않도록 락(Lock) 메커니즘을 적용합니다.

### 2.2. 주기적 스캔 스케줄러 (Periodic Scanner)
- **작동 방식**: 등록된 모든 저장소를 대상으로 일정 주기(예: 30분마다)로 `git fetch` 및 최신 커밋 유무를 확인합니다.
- **증분 업데이트**: 새로운 커밋이 발견되면 `Incremental Update` 로직을 트리거하여 `history` 테이블을 최신화합니다.

## 3. 작업 상태 구조 (Task State)
작업의 진행 상태를 메모리 또는 별도의 테이블에서 관리합니다.
- `task_id`: UUID
- `repo_id`: INTEGER
- `task_type`: 'BACKFILL' | 'SCAN'
- `status`: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
- `current_step`: int (현재 처리 커밋 수)
- `total_steps`: int (전체 커밋 수)
- `error_message`: TEXT (실패 시)

## 4. 인터페이스 정의 (Interface)

### 4.1. `WorkerManager` 클래스
- `start_backfill_task(repo_id: int)` -> `str` (Task ID 반환)
  - 별도의 스레드 또는 비기 비동기 태스크로 백필 시작.
- `get_task_status(task_id: str)` -> `Dict`
  - 진행률 및 현재 상태 반환.

### 4.2. `SchedulerService` 클래스
- `initialize_scheduler()`
  - 앱 시작 시 주기적 스캔 작업 등록.
- `trigger_immediate_scan(repo_id: int)`
  - 사용자의 요청에 의한 즉시 스캔 수행.

## 5. 예외 처리 전략 (Error Handling)
- **Git 명령 실패**: 저장소 경로가 유효하지 않거나 네트워크 오류(원격 저장소의 경우) 시 상태를 'FAILED'로 변경하고 로그를 남김.
- **중단 후 재개**: 장시간 걸리는 백필 작업이 시스템 재시작 등으로 중단된 경우, `history` 테이블의 마지막 기록부터 다시 시작할 수 있는 체크포인트 로직 고려.
