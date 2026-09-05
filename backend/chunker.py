"""
chunker.py
----------
Splits source files into chunks at function/class boundaries instead of
arbitrary fixed-length windows. This is the one "smart" piece of the
pipeline: naive RAG tutorials chop text every N characters, which can cut
a function in half. Here we detect lines that *look like* the start of a
function or class definition, and treat everything up to the next such
line as one chunk. It's a simple heuristic, not a real parser, but it
works well across most common languages and is easy to explain.
"""

import re
from dataclasses import dataclass

# Instead of an allowlist of "code" extensions (which always misses some
# language), we take a universal approach: try to index every file, and
# only SKIP the ones we know for certain aren't source code - binaries,
# images, fonts, archives, lockfiles, and generated/minified output.
# See ingest.py's is_probably_text() for the actual binary-detection step,
# which is what makes this genuinely language-agnostic.
SKIP_EXTENSIONS = {
    # images
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svg", ".tiff",
    # fonts
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    # archives / packages
    ".zip", ".tar", ".gz", ".tgz", ".rar", ".7z", ".whl", ".jar", ".war",
    # compiled / binary
    ".exe", ".dll", ".so", ".dylib", ".class", ".pyc", ".o", ".a", ".wasm",
    # media
    ".mp3", ".mp4", ".mov", ".avi", ".wav", ".flac", ".pdf",
    # data / non-code text that isn't useful to "explain"
    ".csv", ".tsv", ".parquet", ".db", ".sqlite", ".sqlite3",
    # lockfiles / generated - huge, not human-authored, low signal
    ".lock",
}

# Specific filenames (not just extensions) worth skipping - typically
# auto-generated, huge, and not something anyone asks "how does this work".
SKIP_FILENAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock",
    "poetry.lock", "Pipfile.lock", ".DS_Store", "composer.lock",
}

# Files bigger than this are almost always generated/minified/data, not
# something you want chunked and embedded (also keeps indexing fast).
MAX_FILE_SIZE_BYTES = 500_000  # 500 KB

# Folders we never want to walk into.
SKIP_DIRS = {
    ".git", "node_modules", "venv", ".venv", "__pycache__",
    "dist", "build", ".next", "target", "vendor", "bin", "obj",
}

# One regex per chunk boundary "shape". If a line matches any of these
# (after stripping leading whitespace), we start a new chunk there.
BOUNDARY_PATTERNS = [
    r"^def\s+\w+\s*\(",                 # python / ruby / elixir function
    r"^class\s+\w+",                    # python / java / c# / ruby class
    r"^(export\s+)?(default\s+)?(async\s+)?function\s+\w+\s*\(",  # js/ts function
    r"^(export\s+)?(default\s+)?class\s+\w+",                     # js/ts class
    r"^(export\s+)?(default\s+)?interface\s+\w+",                 # ts interface
    r"^(public|private|protected|static)[\w\s<>\[\],]*\(",        # java/c#/c++ method
    r"^func\s+\w+\s*\(",                # go / swift
    r"^(pub\s+)?(async\s+)?fn\s+\w+",   # rust
    r"^fun\s+\w+\s*\(",                 # kotlin
    r"^module\s+\w+",                   # ruby module
    r"^sub\s+\w+",                      # perl
    r"^\w+\s*::\s*\w+\s*=",             # elixir/erlang-style module funcs
]
BOUNDARY_RE = re.compile("|".join(f"({p})" for p in BOUNDARY_PATTERNS))

MAX_CHUNK_LINES = 200   # hard cap so one giant function doesn't dominate context
MIN_CHUNK_LINES = 3     # ignore trivial one-line "chunks"


@dataclass
class Chunk:
    code: str
    file_path: str      # path relative to repo root
    start_line: int      # 1-indexed
    end_line: int
    name: str            # best-guess function/class name, or "module-level"


def _guess_name(first_line: str) -> str:
    """Best-effort extraction of the function/class name from a boundary
    line, across whichever language it came from."""
    line = first_line.strip()
    # Covers: def/class/function/func/fn/fun/sub/module, optionally preceded
    # by keywords like pub/export/async/public/private/static.
    match = re.search(
        r"(?:def|class|function|func|fn|fun|sub|module|interface)\s+(\w+)", line
    )
    if match:
        return match.group(1)
    # Java/C#-style methods: "public int computeTotal(..." - name is the
    # last word before the opening paren.
    match = re.search(r"(\w+)\s*\(", line)
    if match:
        return match.group(1)
    return "block"


def chunk_file(file_path: str, content: str) -> list[Chunk]:
    """Split one file's content into function/class-level chunks."""
    lines = content.splitlines()
    boundaries = [i for i, line in enumerate(lines) if BOUNDARY_RE.match(line.strip())]

    chunks: list[Chunk] = []

    # Anything before the first boundary is "module-level" code (imports,
    # constants, etc.) - still worth indexing.
    if boundaries and boundaries[0] > 0:
        head = lines[: boundaries[0]]
        if len(head) >= MIN_CHUNK_LINES:
            chunks.append(Chunk(
                code="\n".join(head), file_path=file_path,
                start_line=1, end_line=boundaries[0], name="module-level",
            ))

    if not boundaries:
        # No recognizable function/class in this file - just chunk it
        # in fixed windows so it's still searchable.
        for start in range(0, len(lines), MAX_CHUNK_LINES):
            block = lines[start:start + MAX_CHUNK_LINES]
            if len(block) >= MIN_CHUNK_LINES:
                chunks.append(Chunk(
                    code="\n".join(block), file_path=file_path,
                    start_line=start + 1, end_line=start + len(block),
                    name="block",
                ))
        return chunks

    for idx, start in enumerate(boundaries):
        end = boundaries[idx + 1] if idx + 1 < len(boundaries) else len(lines)
        # Cap runaway chunks (e.g. a 500-line function).
        end = min(end, start + MAX_CHUNK_LINES)
        block = lines[start:end]
        if len(block) < MIN_CHUNK_LINES:
            continue
        chunks.append(Chunk(
            code="\n".join(block),
            file_path=file_path,
            start_line=start + 1,
            end_line=end,
            name=_guess_name(lines[start]),
        ))

    return chunks
