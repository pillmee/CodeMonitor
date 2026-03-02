# PRD: CodeMonitor - Git Code Line Monitoring Tool

## 1. 개요 (Overview)
Android Framework와 같은 대규모 Git 저장소의 소스 코드 전체 라인수를 지속적으로 모니터링하고, 변화량을 시각적으로 표시하는 도구입니다. 수백만 라인 이상의 대규모 코드베이스에서도 안정적인 성능을 제공하는 것을 목표로 합니다.

## 2. 사용자 스토리 (User Story)
- "사용자는 여러 개의 Git 저장소를 등록하고 관리하며, 주기적으로 분석되기를 원한다."
- "사용자는 각 저장소별 변화를 하나의 그래프에서 비교하거나, 모든 저장소의 합계를 통합 그래프로 보고 싶어 한다."
- "사용자는 특정 파일 확장자만 필터링하거나, 특정 폴더를 선택하여 분석하고 싶어 한다."

## 3. 핵심 기능 (Core Features)

### 3.1. Git 저장소 분석 (Git Analyzer)
- **저장소 등록 및 삭제**: 로컬 경로를 통한 Git 저장소 등록 기능 및 저장소 삭제(데이터 포함) 기능 지원.
- **특정 디렉토리 모니터링**: 저장소 전체가 아닌 특정 하위 디렉토리(`include_path`)만 분석하도록 설정 가능.
- **자동 스캔**: 저장소 등록 시 최신 커밋까지 자동으로 감지하여 업데이트.
- **히스토리 백필 (Historical Backfill)**: 저장소의 첫 커밋부터 현재까지의 히스토리를 증분 방식(`git log --numstat`)으로 복원.
- **스키마 자동 마이그레이션**: DB 스켈레톤 유지 및 컬럼 추가(`include_path` 등) 시 자가 진단 및 자동 마이그레이션 수행.

### 3.2. 데이터 수집 및 관리 (Data Management)
- **히스토리 저장**: 각 커밋 시점의 타임스탬프와 누적 총 라인수(Total LOC)를 `history` 테이블에 보관.
- **SQLite 활용**: 가벼운 데이터 저장과 빠른 질의를 위해 SQLite를 기본 DB로 사용.
- **백그라운드 워커**: 대규모 히스토리 분석 시 메인 스레드 차단 없이 백그라운드에서 배치(Batch) 처리.

### 3.3. 대시보드 및 시각화 (Visualization)
- **멀티 라인 그래프**: 선택한 여러 저장소의 라인수 변화를 한 눈에 비교.
- **인터랙티브 차트 컨트롤**:
  - **Zoom In/Out**: 특정 기간 집중 분석 및 전체 보기용 확대/축소 버튼 지원.
  - **Panning**: 좌/우 화살표 버튼을 통한 차트 시점 이동 지원.
  - **Reset**: 초기 선택 기간으로 상시 복귀 기능.
- **상세 툴팁 (Tooltip)**: 데이터 포인트 호버 시 현재 라인수 및 **직전 포인트 대비 증감량(Delta)** 표시 (▲/▼).
- **통합 그래프 (Aggregated View)**: 모든 등록된 저장소의 라인수 합계 표시.

## 4. 기술 스택 (Technical Stack)

- **Backend**: Python 3.10+
  - `FastAPI`: 고성능 비동기 API 서버.
  - `Git (Subprocess)`: `git log --numstat` 호출을 통한 고속 커밋 분석.
  - `SQLite`: 시계열 데이터 관리.
- **Frontend**: Vite + React
  - `Chart.js`: 차트 렌더링 및 커스텀 툴팁/플러그인.
  - `chartjs-plugin-zoom`: 휠/핀치 줌 지원.
  - `Axios`: API 통신 및 동적 Host IP 감지 지원.

## 5. UI/UX 요구사항
- **Responsive Navigation**: 사이드바를 통한 저장소 선택 및 삭제.
- **Premium Design**: Glassmorphism 및 다크 테마가 적용된 모던한 UI.
- **Intuitive Interaction**: 드래그 및 버튼 클릭을 통한 유연한 데이터 탐색.

## 6. 성공 지표 (Success Metrics)
- **대규모 저장소 지원**: Android Framework 기준, 초당 수천 개 커밋의 고속 분석 처리.
- **네트워크 유연성**: 고정 IP가 없는 환경에서도 `window.location.hostname` 기반 API 자동 연결.
- **데이터 직관성**: 라인 수의 절대값과 함께 증감폭(▲/▼)을 툴팁에서 즉시 확인 가능.
