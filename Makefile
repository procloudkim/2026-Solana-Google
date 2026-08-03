PYTHON ?= python
MEDIA_PYTHON ?= .venv-media/Scripts/python.exe
READINESS_ARGS ?=

.PHONY: harness-media harness-sync harness-graph harness-loop harness-prepare harness-ideate harness-status harness-record harness-gate harness-pack harness-test harness-all test all

harness-media:
	$(MEDIA_PYTHON) .harness/workflows/05_media_enrich.py all
	$(PYTHON) .harness/workflows/01_knowledge_extract.py
	$(PYTHON) .harness/workflows/02_graphify_code.py

harness-sync:
	$(PYTHON) .harness/workflows/01_knowledge_extract.py

harness-graph:
	$(PYTHON) .harness/workflows/02_graphify_code.py

harness-loop:
	$(PYTHON) .harness/workflows/03_auto_research.py --iterations 1
	$(PYTHON) .harness/workflows/02_graphify_code.py

harness-prepare:
	$(PYTHON) .harness/workflows/06_readiness.py prepare
	$(PYTHON) .harness/workflows/02_graphify_code.py

harness-ideate:
	$(PYTHON) .harness/workflows/06_readiness.py ideate $(READINESS_ARGS)

harness-status:
	$(PYTHON) .harness/workflows/06_readiness.py status $(READINESS_ARGS)

harness-record:
	$(PYTHON) .harness/workflows/06_readiness.py record $(READINESS_ARGS)

harness-gate:
	$(PYTHON) .harness/workflows/06_readiness.py gate $(READINESS_ARGS)

harness-pack:
	$(PYTHON) .harness/workflows/06_readiness.py pack

harness-test:
	$(PYTHON) -m unittest discover -s tests -p "test_*.py"

harness-all:
	$(PYTHON) .harness/workflows/01_knowledge_extract.py
	$(PYTHON) .harness/workflows/06_readiness.py prepare
	$(PYTHON) .harness/workflows/02_graphify_code.py
	$(PYTHON) .harness/workflows/03_auto_research.py --iterations 1
	$(PYTHON) .harness/workflows/02_graphify_code.py
	$(PYTHON) -m unittest discover -s tests -p "test_*.py"

test: harness-test

all: harness-all
