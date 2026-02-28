# CodeMonitor

CodeMonitor는 Git 저장소 활동을 모니터링하고 여러 프로젝트의 코드 라인(LOC) 증가 및 이력을 시각화하는 강력한 도구입니다. 개발 트렌드 분석을 위한 실시간 대시보드를 제공합니다.

## 주요 기능

- **멀티 저장소 추적**: 여러 Git 저장소를 동시에 모니터링할 수 있습니다.
- **역사적 LOC 분석**: 코드베이스가 시간에 따라 어떻게 성장했는지 시각적으로 확인할 수 있습니다.
- **자동 백필(Backfill)**: 과거 커밋을 자동으로 분석하여 전체 이력 데이터를 구축합니다.
- **FastAPI 백엔드**: 데이터 관리를 위한 고성능 비동기 API 서버입니다.
- **Vite/React 프론트엔드**: 데이터 시각화를 위한 현대적이고 반응형인 대시보드입니다.

## 사전 요구 사항

- **운영체제**: macOS 또는 Linux (Ubuntu/Debian 권장)
- **Git**: 저장소 분석을 위해 필수적으로 설치되어 있어야 합니다.
- **Python**: 3.10 이상 버전이 필요합니다.
- **Node.js**: 18 이상 버전이 필요합니다.
- **cloc**: 코드 라인 수를 측정하기 위해 필요합니다.

## 설치 및 설정

`implements` 디렉토리로 이동하여 설정 스크립트를 실행하세요:

```bash
cd implements
./setup.sh
```

이 스크립트는 다음 작업을 수행합니다:
1. 시스템 의존성 확인 (리눅스의 경우 필요한 경우 Node.js 업그레이드 시도).
2. Python 가상 환경(venv) 생성 및 패키지 설치.
3. 프론트엔드 Node.js 패키지 설치.

> [!TIP]
> 리눅스 환경에서 실행 시 `ENOSPC` 에러가 발생한다면, 아래 명령어를 실행하여 파일 감시 제한을 늘려주세요:
> `echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p`

## 실행 방법

`run.sh` 스크립트를 사용하여 백엔드와 프론트엔드 서버를 동시에 실행할 수 있습니다:

```bash
cd implements
./run.sh
```

### 실행 옵션

포트 번호를 직접 지정하여 실행할 수 있습니다:

```bash
./run.sh -b 8080 -f 3000
```

- `-b`, `--bp`, `--backend-port`: 백엔드 API 포트 설정 (기본값: 8000)
- `-f`, `--fp`, `--frontend-port`: 프론트엔드 UI 포트 설정 (기본값: 5173)

## 프로젝트 구조

- `implements/backend`: FastAPI 애플리케이션 및 Git 분석 로직.
- `implements/frontend`: 대시보드를 위한 Vite 기반 React 애플리케이션.
- `implements/setup.sh`: 크로스 플랫폼 초기화 및 설정 스크립트.
- `implements/run.sh`: 통합 서버 실행 및 관리 스크립트.

## 라이선스

MIT License
