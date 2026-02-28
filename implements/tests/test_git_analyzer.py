import sys
import os
# 모듈 경로 추가
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/core")))

from git_analyzer import GitAnalyzer

def test_analyzer():
    # 현재 저장소 경로 사용 (implements/tests/에서 2단계 상위가 CodeMonitor 루트)
    repo_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
    print(f"Testing GitAnalyzer on: {repo_path}")
    
    analyzer = GitAnalyzer(repo_path)
    
    print("\n--- Commits Summary ---")
    count = 0
    total_added = 0
    total_deleted = 0
    
    for commit in analyzer.get_commits_generator():
        count += 1
        total_added += commit['insertions']
        total_deleted += commit['deletions']
        if count <= 5:  # 처음 5개만 출력
            print(f"[{commit['hash'][:8]}] {commit['date']} | +{commit['insertions']} -{commit['deletions']}")
    
    print(f"...")
    print(f"Total Commits: {count}")
    print(f"Total Added: {total_added}")
    print(f"Total Deleted: {total_deleted}")
    print(f"Current Net LOC (Estimated): {total_added - total_deleted}")

    latest = analyzer.get_latest_commit_hash()
    print(f"\nLatest Commit: {latest}")

if __name__ == "__main__":
    test_analyzer()
