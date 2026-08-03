#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$repo_root"

if command -v python >/dev/null 2>&1; then
    harness_python=python
elif command -v python3 >/dev/null 2>&1; then
    harness_python=python3
else
    echo "Python 3 was not found on PATH." >&2
    exit 127
fi

run_step() {
    step=$1
    shift
    case "$step" in
        media)
            if [ -x .venv-media/bin/python ]; then
                media_python=.venv-media/bin/python
            elif [ -x .venv-media/Scripts/python.exe ]; then
                media_python=.venv-media/Scripts/python.exe
            else
                echo "Media Python is missing; create .venv-media and install requirements-media.txt." >&2
                return 2
            fi
            "$media_python" .harness/workflows/05_media_enrich.py all
            "$harness_python" .harness/workflows/01_knowledge_extract.py
            "$harness_python" .harness/workflows/02_graphify_code.py
            ;;
        sync)
            "$harness_python" .harness/workflows/01_knowledge_extract.py
            ;;
        graph)
            "$harness_python" .harness/workflows/02_graphify_code.py
            ;;
        loop)
            "$harness_python" .harness/workflows/03_auto_research.py --iterations 1
            "$harness_python" .harness/workflows/02_graphify_code.py
            ;;
        prepare)
            "$harness_python" .harness/workflows/06_readiness.py prepare "$@"
            "$harness_python" .harness/workflows/02_graphify_code.py
            ;;
        ideate|status|record|gate|pack)
            "$harness_python" .harness/workflows/06_readiness.py "$step" "$@"
            ;;
        test)
            "$harness_python" -m unittest discover -s tests -p 'test_*.py'
            ;;
        *)
            echo "usage: $0 {media|sync|graph|loop|prepare|ideate|status|record|gate|pack|test|all}" >&2
            return 2
            ;;
    esac
}

command_name=${1:-all}
if [ "$#" -gt 0 ]; then
    shift
fi
if [ "$command_name" = "all" ]; then
    for step in sync prepare loop test; do
        run_step "$step"
    done
else
    run_step "$command_name" "$@"
fi
