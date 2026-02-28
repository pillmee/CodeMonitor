import subprocess
import json
import os
from typing import Dict, List, Optional

class LOCEngine:
    """
    cloc (Count Lines of Code) 도구를 사용하여 특정 시점의 전체 라인수를 측정하는 클래스.
    """

    def __init__(self, repo_path: str, cloc_path: str = "cloc"):
        self.repo_path = repo_path
        self.cloc_path = cloc_path

    def is_cloc_available(self) -> bool:
        """시스템에 cloc이 설치되어 있는지 확인합니다."""
        try:
            subprocess.run([self.cloc_path, "--version"], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def count_loc(self, commit_hash: str = "HEAD") -> Dict:
        """
        특정 커밋 시점의 전체 라인수를 측정합니다.
        성능을 위해 --json 출력을 사용하며, 임시 체크아웃 없이 git archive를 활용할 수 있습니다.
        하지만 cloc은 디렉토리 스캔에 최적화되어 있으므로, 
        대규모 저장소의 경우 특정 시점으로 'git checkout'이 되어 있는 상태에서 실행하는 것이 일반적입니다.
        (백필 시에는 git log 기반 증분 계산을 우선하고, 체크포인트에서만 count_loc을 호출하는 전략)
        """
        
        # 임시로 현재 작업 디렉토리의 상태를 측정하는 로직
        # 실제 구현에서는 특정 커밋을 측정하기 위해 git archive | cloc --stdin-name=... 또는 
        # 임시 디렉토리 클론 등을 고려해야 함.
        # 여기서는 단순화를 위해 현재 repo_path의 상태를 측정합니다.
        
        cmd = [self.cloc_path, ".", "--json", "--quiet"]
        try:
            result = subprocess.run(
                cmd, 
                cwd=self.repo_path, 
                capture_output=True, 
                text=True, 
                check=True
            )
            data = json.loads(result.stdout)
            
            # cloc 결과에서 'SUM' 섹션 추출
            if "SUM" in data:
                return {
                    "total_files": data["SUM"]["nFiles"],
                    "total_loc": data["SUM"]["code"],
                    "blank": data["SUM"]["blank"],
                    "comment": data["SUM"]["comment"]
                }
            return {"total_loc": 0}

        except subprocess.CalledProcessError as e:
            print(f"Error running cloc: {e.stderr}")
            return {"total_loc": 0}
        except json.JSONDecodeError:
            print("Error parsing cloc output as JSON")
            return {"total_loc": 0}

    def get_supported_languages(self) -> List[str]:
        """cloc이 지원하는 언어 목록을 반환합니다."""
        cmd = [self.cloc_path, "--show-lang"]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            # 파싱 로직 (생략 가능, 필요시 구현)
            return result.stdout.splitlines()
        except subprocess.CalledProcessError:
            return []
