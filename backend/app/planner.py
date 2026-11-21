"""Planning helpers: prerequisite graph, conflict detection and course suggestions.

The suggester is deliberately rule-based and explainable (every score comes
with human-readable reasons). It is the hook where an LLM could later be
plugged in, but it works fully offline.
"""
from __future__ import annotations

import re
from typing import Optional

from .models import WEEKDAYS

ACTIVE = ("planned", "in_progress")


def _by_code(courses: list[dict]) -> dict[str, dict]:
    return {c["code"]: c for c in courses}


def _dates_overlap(a: dict, b: dict) -> bool:
    if not (a.get("start_date") and a.get("end_date") and b.get("start_date") and b.get("end_date")):
        return True  # unknown period: assume they can clash
    return a["start_date"] <= b["end_date"] and b["start_date"] <= a["end_date"]


def session_clashes(a: dict, b: dict) -> list[tuple[dict, dict]]:
    if not _dates_overlap(a, b):
        return []
    out = []
    for sa in a.get("sessions", []):
        for sb in b.get("sessions", []):
            if sa["weekday"] == sb["weekday"] and sa["start_time"] < sb["end_time"] and sb["start_time"] < sa["end_time"]:
                out.append((sa, sb))
    return out


# ---------------------------------------------------------------- graph

def prerequisite_graph(courses: list[dict]) -> dict:
    by_code = _by_code(courses)
    nodes: dict[str, dict] = {
        c["code"]: {"code": c["code"], "title": c["title"], "id": c["id"], "status": c.get("status"), "external": False}
        for c in courses
    }
    edges = []
    for c in courses:
        for p in c.get("prerequisites", []):
            if p not in nodes:
                nodes[p] = {"code": p, "title": "(not in catalog)", "id": None, "status": None, "external": True}
            edges.append({"from": p, "to": c["code"]})

    depth: dict[str, int] = {}

    def visit(code: str, stack: frozenset) -> int:
        if code in depth:
            return depth[code]
        if code in stack:  # cycle guard
            return 0
        course = by_code.get(code)
        prereqs = course.get("prerequisites", []) if course else []
        d = 0 if not prereqs else 1 + max(visit(p, stack | {code}) for p in prereqs)
        depth[code] = d
        return d

    for code in nodes:
        visit(code, frozenset())
    for code, node in nodes.items():
        node["depth"] = depth[code]
    return {"nodes": sorted(nodes.values(), key=lambda n: (n["depth"], n["code"])), "edges": edges}


# ---------------------------------------------------------------- conflicts

def _fmt(s: dict) -> str:
    return f"{WEEKDAYS[s['weekday']]} {s['start_time']}–{s['end_time']}"


def find_conflicts(courses: list[dict]) -> list[dict]:
    by_code = _by_code(courses)
    active = [c for c in courses if c.get("status") in ACTIVE]
    conflicts: list[dict] = []

    for i, a in enumerate(active):
        for b in active[i + 1 :]:
            for sa, sb in session_clashes(a, b):
                conflicts.append(
                    {
                        "type": "schedule",
                        "severity": "error",
                        "courses": [a["code"], b["code"]],
                        "message": f"{a['code']} {sa['kind']} ({_fmt(sa)}) overlaps with "
                        f"{b['code']} {sb['kind']} ({_fmt(sb)})",
                    }
                )

    for c in active:
        for p in c.get("prerequisites", []):
            pre = by_code.get(p)
            status = pre.get("status") if pre else None
            if status == "completed":
                continue
            if status in ACTIVE:
                conflicts.append(
                    {
                        "type": "prerequisite",
                        "severity": "warning",
                        "courses": [c["code"], p],
                        "message": f"{c['code']} needs {p}, which is in your plan but not completed yet",
                    }
                )
            else:
                conflicts.append(
                    {
                        "type": "prerequisite",
                        "severity": "error",
                        "courses": [c["code"], p],
                        "message": f"{c['code']} needs {p}, which you have not completed or planned",
                    }
                )
    return conflicts


# ---------------------------------------------------------------- suggestions

_WORD = re.compile(r"[a-zA-Z0-9]+")


def suggest(courses: list[dict], interests: Optional[list[str]] = None, limit: int = 5) -> list[dict]:
    by_code = _by_code(courses)
    interests = [i.lower() for i in (interests or []) if i.strip()]
    active = [c for c in courses if c.get("status") in ACTIVE]
    unlocks: dict[str, list[str]] = {}
    for c in courses:
        for p in c.get("prerequisites", []):
            unlocks.setdefault(p, []).append(c["code"])

    results = []
    for c in courses:
        if c.get("status"):
            continue
        reasons: list[str] = []
        score = 1.0
        missing = [p for p in c.get("prerequisites", []) if (by_code.get(p) or {}).get("status") != "completed"]
        not_planned = [p for p in missing if (by_code.get(p) or {}).get("status") not in ACTIVE]
        if not_planned:
            continue  # locked: prerequisites not done or planned
        if c.get("prerequisites") and not missing:
            score += 2
            reasons.append(f"You completed its prerequisites ({', '.join(c['prerequisites'])})")
        elif missing:
            score -= 1
            reasons.append(f"Prerequisites still in progress: {', '.join(missing)}")
        elif not c.get("prerequisites"):
            reasons.append("No prerequisites – open to start")

        opened = unlocks.get(c["code"], [])
        if opened:
            score += 1.5 * min(len(opened), 3)
            reasons.append(f"Unlocks {len(opened)} course(s): {', '.join(opened)}")

        if interests:
            text = f"{c['title']} {c.get('description', '')}".lower()
            words = set(_WORD.findall(text))
            hits = [i for i in interests if i in words or (len(i) > 3 and i in text)]
            if hits:
                score += 3 * len(hits)
                reasons.append(f"Matches your interests: {', '.join(hits)}")

        clashes = [a["code"] for a in active if session_clashes(c, a)]
        if clashes:
            score -= 4
            reasons.append(f"Timetable clash with {', '.join(clashes)}")

        results.append({"course": c, "score": round(score, 1), "reasons": reasons})

    results.sort(key=lambda r: (-r["score"], r["course"]["code"]))
    return results[:limit]
