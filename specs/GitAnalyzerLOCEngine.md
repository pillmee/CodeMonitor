# Module Spec: GitAnalyzer & LOCEngine

## 1. 개요 (Overview)
이 모듈은 등록된 여러 Git 저장소의 데이터를 개별적으로 분석하여 시간 흐름에 따른 소스 코드 라인수 변화를 추출하는 핵심 엔진입니다. 저장소별 독립적인 분석 세션을 관리하며, 대규모 저장소 지원을 위한 최적화 기법을 적용합니다.

## 2. 주요 기능 (Key Functions)

### 2.1. Git Log 파싱 (Backfill)
- **명령어**: `git log --reverse --numstat --pretty=format:"commit:%H author_date:%ai"`
- **처리 방식**:
  - 첫 번째 커밋부터 최신 커밋까지 순차적으로 처리.
  - 각 커밋의 `insertions`와 `deletions` 합계를 구함.
  - `total_loc = previous_total + insertions - deletions` 수식을 적용.
  - **Memory Optimization**: `subprocess.Popen`과 제너레이터(Generator)를 통해 로그를 한 줄씩 스트리밍 파싱.

### 2.2. LOC 물리 측정 (Baseline)
- **도구**: `cloc (Count Lines of Code)`
- **용도**: 현재 시점(HEAD)의 정확한 물리적 라인수를 1회 측정하여 백필 데이터의 오차를 보정하거나 초기 기준점을 생성.
- **필터링**: `.java`, `.cpp`, `.h`, `.py`, `.kt` 등 주요 소스 파일 확장자만 포함하도록 설정 가능.

### 2.3. 증분 분석 (Incremental Update)
- **명령어**: `git diff --numstat HEAD~1 HEAD`
- **용도**: 주기적인 스캔 시 최신 커밋 변경분만 빠르게 계산하여 기존 데이터에 추가.

## 3. 인터페이스 정의 (Interface)

### 3.1. `GitAnalyzer` 클래스
- `get_commits_generator(repo_path: str)` -> `Iterator[Dict]`
  - 커밋 해시, 날짜, 증감 라인수 정보를 포함한 딕셔너리 생성.
- `get_incremental_change(repo_path: str)` -> `Dict`
  - 최신 변경분 반환.

### 3.2. `LOCEngine` 클래스
- `measure_total_loc(repo_path: str, extensions: List[str])` -> `int`
  - `cloc` 실행 결과 반환.

## 4. 성능 고려사항 (Performance)
- **대규모 로그**: Android Framework는 수십만 개의 커밋이 존재할 수 있으므로, 전체 로그를 메모리에 적재하지 않고 한 줄씩 파싱하여 처리해야 함.
- **병렬 처리**: `cloc` 실행은 CPU 집약적 작업이므로 별도의 백그라운드 프로세스에서 실행 권장.
