[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("media", "sync", "graph", "loop", "prepare", "ideate", "status", "record", "gate", "pack", "test", "all")]
    [string]$Command = "all",

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ReadinessArgs = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-HarnessPython {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    & python @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Harness command failed with exit code $LASTEXITCODE."
    }
}

function Invoke-HarnessStep {
    param([Parameter(Mandatory = $true)][string]$Step)

    switch ($Step) {
        "media" {
            $mediaPython = Join-Path $PSScriptRoot ".venv-media\Scripts\python.exe"
            if (-not (Test-Path -LiteralPath $mediaPython -PathType Leaf)) {
                throw "Media Python is missing. Run: uv venv .venv-media --python 3.12; uv pip install -p .venv-media -r requirements-media.txt"
            }
            & $mediaPython ".harness/workflows/05_media_enrich.py" "all"
            if ($LASTEXITCODE -ne 0) {
                throw "Media enrichment failed with exit code $LASTEXITCODE."
            }
            Invoke-HarnessPython @(".harness/workflows/01_knowledge_extract.py")
            Invoke-HarnessPython @(".harness/workflows/02_graphify_code.py")
        }
        "sync" {
            Invoke-HarnessPython @(".harness/workflows/01_knowledge_extract.py")
        }
        "graph" {
            Invoke-HarnessPython @(".harness/workflows/02_graphify_code.py")
        }
        "loop" {
            Invoke-HarnessPython @(".harness/workflows/03_auto_research.py", "--iterations", "1")
            Invoke-HarnessPython @(".harness/workflows/02_graphify_code.py")
        }
        "prepare" {
            Invoke-HarnessPython @(".harness/workflows/06_readiness.py", "prepare")
            Invoke-HarnessPython @(".harness/workflows/02_graphify_code.py")
        }
        "ideate" {
            Invoke-HarnessPython (@(".harness/workflows/06_readiness.py", "ideate") + $ReadinessArgs)
        }
        "status" {
            Invoke-HarnessPython (@(".harness/workflows/06_readiness.py", "status") + $ReadinessArgs)
        }
        "record" {
            Invoke-HarnessPython (@(".harness/workflows/06_readiness.py", "record") + $ReadinessArgs)
        }
        "gate" {
            Invoke-HarnessPython (@(".harness/workflows/06_readiness.py", "gate") + $ReadinessArgs)
        }
        "pack" {
            Invoke-HarnessPython @(".harness/workflows/06_readiness.py", "pack")
        }
        "test" {
            Invoke-HarnessPython @("-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py")
        }
    }
}

Push-Location -LiteralPath $PSScriptRoot
try {
    if ($Command -eq "all") {
        foreach ($step in @("sync", "prepare", "loop", "test")) {
            Invoke-HarnessStep $step
        }
    }
    else {
        Invoke-HarnessStep $Command
    }
}
finally {
    Pop-Location
}
