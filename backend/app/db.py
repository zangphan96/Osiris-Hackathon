"""SQLite storage using plain SQL (easy to port to PostgreSQL later)."""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional

from .models import CourseIn

DB_PATH = Path(os.environ.get("OCC_DB", Path(__file__).resolve().parent.parent / "courses.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS courses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT NOT NULL UNIQUE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    ects        REAL NOT NULL DEFAULT 7.5,
    language    TEXT NOT NULL DEFAULT 'en',
    teacher     TEXT NOT NULL DEFAULT '',
    provider    TEXT NOT NULL DEFAULT '',
    level       TEXT NOT NULL DEFAULT '',
    start_date  TEXT,
    end_date    TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prerequisites (
    course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    prereq_code TEXT NOT NULL,
    PRIMARY KEY (course_id, prereq_code)
);

CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL DEFAULT 'Lecture',
    weekday     INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    start_time  TEXT NOT NULL,
    end_time    TEXT NOT NULL,
    location    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS plan (
    course_id   INTEGER PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
    status      TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'completed'))
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)


# ---------------------------------------------------------------- reads

def _hydrate(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    course = dict(row)
    cid = course["id"]
    course["prerequisites"] = [
        r["prereq_code"]
        for r in conn.execute(
            "SELECT prereq_code FROM prerequisites WHERE course_id = ? ORDER BY prereq_code", (cid,)
        )
    ]
    course["sessions"] = [
        dict(r)
        for r in conn.execute(
            "SELECT id, kind, weekday, start_time, end_time, location FROM sessions "
            "WHERE course_id = ? ORDER BY weekday, start_time",
            (cid,),
        )
    ]
    return course


_SELECT = """
SELECT c.*, p.status AS status
FROM courses c LEFT JOIN plan p ON p.course_id = c.id
"""


def list_courses(conn: sqlite3.Connection, q: Optional[str] = None) -> list[dict]:
    if q:
        like = f"%{q}%"
        rows = conn.execute(
            _SELECT + " WHERE c.code LIKE ? OR c.title LIKE ? OR c.description LIKE ? OR c.teacher LIKE ?"
            " ORDER BY c.code",
            (like, like, like, like),
        ).fetchall()
    else:
        rows = conn.execute(_SELECT + " ORDER BY c.code").fetchall()
    return [_hydrate(conn, r) for r in rows]


def get_course(conn: sqlite3.Connection, course_id: int) -> Optional[dict]:
    row = conn.execute(_SELECT + " WHERE c.id = ?", (course_id,)).fetchone()
    return _hydrate(conn, row) if row else None


def get_course_by_code(conn: sqlite3.Connection, code: str) -> Optional[dict]:
    row = conn.execute(_SELECT + " WHERE c.code = ?", (code.upper(),)).fetchone()
    return _hydrate(conn, row) if row else None


# ---------------------------------------------------------------- writes

def _write_children(conn: sqlite3.Connection, course_id: int, data: CourseIn) -> None:
    conn.execute("DELETE FROM prerequisites WHERE course_id = ?", (course_id,))
    conn.execute("DELETE FROM sessions WHERE course_id = ?", (course_id,))
    conn.executemany(
        "INSERT INTO prerequisites (course_id, prereq_code) VALUES (?, ?)",
        [(course_id, p) for p in data.prerequisites if p != data.code],
    )
    conn.executemany(
        "INSERT INTO sessions (course_id, kind, weekday, start_time, end_time, location) VALUES (?, ?, ?, ?, ?, ?)",
        [(course_id, s.kind, s.weekday, s.start_time, s.end_time, s.location) for s in data.sessions],
    )


_FIELDS = ("code", "title", "description", "ects", "language", "teacher", "provider", "level", "start_date", "end_date")


def create_course(conn: sqlite3.Connection, data: CourseIn) -> int:
    now = _now()
    values = [getattr(data, f) for f in _FIELDS]
    cur = conn.execute(
        f"INSERT INTO courses ({', '.join(_FIELDS)}, created_at, updated_at) "
        f"VALUES ({', '.join('?' for _ in _FIELDS)}, ?, ?)",
        (*values, now, now),
    )
    course_id = cur.lastrowid
    _write_children(conn, course_id, data)
    return course_id


def update_course(conn: sqlite3.Connection, course_id: int, data: CourseIn) -> None:
    sets = ", ".join(f"{f} = ?" for f in _FIELDS)
    conn.execute(
        f"UPDATE courses SET {sets}, updated_at = ? WHERE id = ?",
        (*[getattr(data, f) for f in _FIELDS], _now(), course_id),
    )
    _write_children(conn, course_id, data)


def delete_course(conn: sqlite3.Connection, course_id: int) -> bool:
    return conn.execute("DELETE FROM courses WHERE id = ?", (course_id,)).rowcount > 0


def set_status(conn: sqlite3.Connection, course_id: int, status: Optional[str]) -> None:
    if status is None:
        conn.execute("DELETE FROM plan WHERE course_id = ?", (course_id,))
    else:
        conn.execute(
            "INSERT INTO plan (course_id, status) VALUES (?, ?) "
            "ON CONFLICT(course_id) DO UPDATE SET status = excluded.status",
            (course_id, status),
        )


def count_courses(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM courses").fetchone()[0]
