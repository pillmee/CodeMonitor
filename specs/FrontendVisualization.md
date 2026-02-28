# Module Spec: Frontend Visualization

## 1. 개요 (Overview)
이 모듈은 소스 코드 라인수 변화를 사용자에게 시각적으로 보여주는 현대적인 웹 대시보드입니다. 다중 저장소 비교, 통합 뷰, 실시간 작업 모니터링 기능을 제공하며, 프리미엄 다크 테마 디자인을 지향합니다.

## 2. 디자인 및 레이아웃 (Layout)

### 2.1. 컨셉: Premium Dark Mode
- **색상**: Deep Charcoal 배경 (#121212), Neon Blue/Violet 주요 포인트.
- **스타일**: 유리모피즘(Glassmorphism) 효과의 카드 UI, 부드러운 트랜지션.
- **폰트**: Inter 또는 Outfit (Google Fonts).

### 2.2. 페이지 구조
- **Header**: 로고, 전역 설정 아이콘, 현재 전체 저장소 수 요약.
- **Sidebar**: 등록된 저장소 목록 (분석중/완료 상태 표시), 저장소 추가 버튼.
- **Main Chart Area**: 
  - `Multi-Line Chart`: 개별 저장소 비교용.
  - `Stacked/Area Chart`: 전체 코드량 통합용.
- **Summary Cards**: 현재 총 라인수, 24시간 증감량, 분석 속도 등.

## 3. 핵심 기능 (Features)

### 3.1. 인터랙티브 차트 (Chart.js)
- **Multi-Dataset**: 여러 저장소 데이터를 각각의 선으로 그래프화.
- **Time Scaling**: 일/주/월 단위 스케일 조정 및 줌(Zoom/Pan) 지원.
- **Decimation**: 수만 개의 데이터 포인트 중 필요한 포인트만 샘플링하여 렌더링 성능 최적화.

### 3.2. 저장소 관리 UI
- **Add Repo Modern Modal**: 로컬 경로 입력 및 별칭 설정.
- **Task Progress Bar**: 백필(Backfill) 진행 상황을 애니메이션으로 표시.

### 3.3. 통합 뷰 토글
- "통합해서 보기" 스위치를 제공하여 모든 데이터셋의 Y축 값을 합산한 단일 그래프 전환 기능.

## 4. 기술 스택 (Technical Stack)
- **Bundler**: Vite
- **UI Framework**: React (or Vanilla JS)
- **Styling**: Vanilla CSS (CSS Variables 활용)
- **Chart Library**: `Chart.js` + `chartjs-plugin-zoom`
- **API Client**: `Axios` 또는 `Fetch API`

## 5. 데이터 패칭 전략 (Data Fetching)
- **Initial Load**: 저장소 목록 및 설정값 조회.
- **Periodic Update**: 10초 간격으로 진행 중인 태스크(Backfill) 상태 폴링.
- **On Demand**: 저장소 선택 변경 시 해당 데이터 즉시 패칭.
