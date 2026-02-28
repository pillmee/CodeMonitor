# Module Spec: API Service

## 1. 개요 (Overview)
이 모듈은 프론트엔드 대시보드와 백엔드 코어 로직 간의 인터페이스를 제공합니다. `FastAPI`를 사용하여 비동기 RESTful API를 구현하며, 다중 저장소 관리 및 시계열 데이터 조회를 지원합니다.

## 2. API 엔드포인트 설계 (Endpoints)

### 2.1. 저장소 관리 (Repository Management)
- **`GET /api/repos`**: 등록된 모든 저장소 목록과 현재 상태를 반환.
- **`POST /api/repos`**: 새로운 Git 저장소를 등록. (등록 즉시 백그라운드 백필 작업 트리거)
  - Request Body: `{"name": "Android Framework", "path": "/path/to/repo"}`
- **`DELETE /api/repos/{repo_id}`**: 저장소 및 관련 히스토리 데이터를 삭제.

### 2.2. 통계 및 데이터 (Statistics)
- **`GET /api/stats`**: 그래프 렌더링을 위한 시계열 데이터를 반환.
  - Query Params: 
    - `repo_ids`: 쉼표로 구분된 ID 목록 (예: `1,2,5`) 또는 `all`.
    - `aggregate`: `true`로 설정 시 모든 저장소의 합계(Sum) 데이터 반환.
- **`GET /api/summary`**: 전체 저장소 수, 총 라인수, 최근 변화량 등 요약 정보 반환.

### 2.3. 시스템 및 작업 (System & Tasks)
- **`GET /api/tasks/{task_id}`**: 특정 백그라운드 작업(백필 등)의 진행 상태 및 완료 여부 조회.
- **`GET /api/settings`**: 전역 설정값 조회.
- **`PATCH /api/settings`**: 전역 설정값 업데이트.

## 3. 데이터 규격 (Data Models)

### 3.1. Stats Response
```json
{
  "datasets": [
    {
      "label": "Android Framework",
      "data": [
        {"x": "2023-01-01T12:00:00Z", "y": 5000000},
        {"x": "2023-01-02T12:00:00Z", "y": 5000120}
      ]
    }
  ]
}
```

## 4. 보안 및 성능 (Security & Performance)
- **CORS 설정**: 프론트엔드 호스트(Vite dev server 등)에 대해 CORS 허용.
- **비동기 처리**: 워커 트리거 등 I/O가 발생하는 작업은 `await` 및 비동기 함수를 사용하여 서버 블로킹 방지.
- **Gzip 압축**: 대량의 시계열 데이터 전송 시 대역폭 절약을 위해 응답 압축 기능 활성화.
