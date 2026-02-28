import subprocess
import re
from datetime import datetime
from typing import Iterator, Dict, Optional

class GitAnalyzer:
    """
    Git 저장소의 로그를 분석하여 커밋별 라인수 증감을 추출하는 클래스.
    대규모 저장소 지원을 위해 subprocess.Popen과 제너레이터를 사용합니다.
    """

    def __init__(self, repo_path: str, include_path: Optional[str] = None):
        self.repo_path = repo_path
        self.include_path = include_path

    def get_commits_generator(self) -> Iterator[Dict]:
        """
        저장소의 첫 커밋부터 최신 커밋까지 순차적으로 커밋 정보를 추출하는 제너레이터.
        수행 명령어: git log --reverse --numstat --pretty=format:"commit:%H author_date:%ai"
        """
        cmd = [
            "git", "log", 
            "--reverse", 
            "--numstat", 
            "--pretty=format:commit:%H author_date:%ai"
        ]
        
        if self.include_path:
            cmd.extend(["--", self.include_path])

        process = subprocess.Popen(
            cmd, 
            cwd=self.repo_path, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            text=True,
            bufsize=1  # Line buffered
        )

        current_commit = None

        try:
            for line in process.stdout:
                line = line.strip()
                if not line:
                    continue

                # 새로운 커밋 헤더 시작
                if line.startswith("commit:"):
                    if current_commit:
                        yield current_commit
                    
                    # commit:HASH author_date:YYYY-MM-DD HH:MM:SS +ZZZZ
                    parts = line.split(" author_date:")
                    commit_hash = parts[0].replace("commit:", "").strip()
                    date_str = parts[1].strip()
                    
                    current_commit = {
                        "hash": commit_hash,
                        "date": date_str,
                        "insertions": 0,
                        "deletions": 0
                    }
                
                # numstat 라인 파싱 (added deleted path)
                elif current_commit and re.match(r'^(\d+|-)\s+(\d+|-)\s+.*', line):
                    parts = line.split()
                    if len(parts) >= 2:
                        added = 0 if parts[0] == "-" else int(parts[0])
                        deleted = 0 if parts[1] == "-" else int(parts[1])
                        current_commit["insertions"] += added
                        current_commit["deletions"] += deleted

            # 마지막 커밋 전송
            if current_commit:
                yield current_commit

        finally:
            process.stdout.close()
            process.wait()

    def get_latest_commit_hash(self) -> Optional[str]:
        """최신 커밋 해시를 반환합니다."""
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError:
            return None

    def get_incremental_change(self, base_commit: str, target_commit: str = "HEAD") -> Dict:
        """
        두 커밋 사이의 변경 사항(증감)을 계산합니다.
        """
        cmd = ["git", "diff", "--numstat", f"{base_commit}..{target_commit}"]
        if self.include_path:
            cmd.extend(["--", self.include_path])
        
        result = subprocess.run(
            cmd,
            cwd=self.repo_path,
            capture_output=True,
            text=True,
            check=True
        )

        summary = {"insertions": 0, "deletions": 0}
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 2:
                added = 0 if parts[0] == "-" else int(parts[0])
                deleted = 0 if parts[1] == "-" else int(parts[1])
                summary["insertions"] += added
                summary["deletions"] += deleted
        
        return summary
