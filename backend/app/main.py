"""Open Course Companion – FastAPI backend.

Enter  : POST/PUT /api/courses           → SQLite
Pass on: /api/courses/{id}.ics, .jsonld, QR, /api/export/*, POST /api/import
Show   : GET endpoints consumed by the React frontend (and anyone else – see /docs)
"""
from __future__ import annotations

import io
import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

import segno
from fastapi import Body, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import db, formats, planner
from .models import Course, CourseIn, ImportResult, PlanUpdate, Status
from .seed import SAMPLE_COURSES, SAMPLE_PLAN

JSONLD = "application/ld+json"
ICS = "text/calendar; charset=utf-8"

@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init_db()
    seed()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Open Course Companion API",
    version="1.0.0",
    description=(
        "Enter, pass on and show course information using open standards: "
        "iCalendar (RFC 5545), JSON-LD with schema.org/Course, and this OpenAPI description."
    ),
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def base_url(request: Request) -> str:
    return str(request.base_url).rstrip("/")


def seed(reset: bool = False) -> None:
    with db.get_conn() as conn:
        if reset:
            conn.execute("DELETE FROM courses")
        if db.count_courses(conn):
            return
        for c in SAMPLE_COURSES:
            db.create_course(conn, c)
        for code, status in SAMPLE_PLAN.items():
            db.set_status(conn, db.get_course_by_code(conn, code)["id"], status)



def _get_or_404(conn, course_id: int) -> dict:
    course = db.get_course(conn, course_id)
    if not course:
        raise HTTPException(404, f"Course {course_id} not found")
    return course


def _download(content: bytes | str, media_type: str, filename: str, inline: bool = False) -> Response:
    disp = "inline" if inline else "attachment"
    return Response(content, media_type=media_type, headers={"Content-Disposition": f'{disp}; filename="{filename}"'})


# ====================================================================== meta

@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {"ok": True}


@app.post("/api/demo/reset", tags=["meta"], summary="Reset the database to the sample data")
def demo_reset() -> dict:
    seed(reset=True)
    return {"ok": True}


# ====================================================================== courses (enter + show)

@app.get("/api/courses", response_model=list[Course], tags=["courses"])
def list_courses(q: Optional[str] = None):
    with db.get_conn() as conn:
        return db.list_courses(conn, q)


@app.post("/api/courses", response_model=Course, status_code=201, tags=["courses"])
def create_course(data: CourseIn):
    with db.get_conn() as conn:
        if db.get_course_by_code(conn, data.code):
            raise HTTPException(409, f"A course with code {data.code} already exists")
        return db.get_course(conn, db.create_course(conn, data))


# Format-suffixed routes are declared before /{course_id} so they match first.
@app.get("/api/courses/{course_id}.ics", tags=["pass on"], summary="Course timetable as iCalendar")
def course_ics(course_id: int, request: Request):
    with db.get_conn() as conn:
        c = _get_or_404(conn, course_id)
    return _download(formats.to_ics([c], base_url(request), name=f"{c['code']} {c['title']}"), ICS, f"{c['code']}.ics")


@app.get("/api/courses/{course_id}.jsonld", tags=["pass on"], summary="Course as JSON-LD (schema.org/Course)")
def course_jsonld(course_id: int, request: Request, download: bool = False):
    with db.get_conn() as conn:
        c = _get_or_404(conn, course_id)
    body = json.dumps(formats.course_to_jsonld(c, base_url(request)), indent=2, ensure_ascii=False)
    return _download(body, JSONLD, f"{c['code']}.jsonld", inline=not download)


@app.get("/api/courses/{course_id}.json", tags=["pass on"], include_in_schema=False)
def course_json_alias(course_id: int, request: Request, download: bool = False):
    return course_jsonld(course_id, request, download)


@app.get("/api/courses/{course_id}", response_model=Course, tags=["courses"])
def get_course(course_id: int):
    with db.get_conn() as conn:
        return _get_or_404(conn, course_id)


@app.put("/api/courses/{course_id}", response_model=Course, tags=["courses"])
def update_course(course_id: int, data: CourseIn):
    with db.get_conn() as conn:
        _get_or_404(conn, course_id)
        other = db.get_course_by_code(conn, data.code)
        if other and other["id"] != course_id:
            raise HTTPException(409, f"A course with code {data.code} already exists")
        db.update_course(conn, course_id, data)
        return db.get_course(conn, course_id)


@app.delete("/api/courses/{course_id}", status_code=204, tags=["courses"])
def delete_course(course_id: int):
    with db.get_conn() as conn:
        if not db.delete_course(conn, course_id):
            raise HTTPException(404, f"Course {course_id} not found")
    return Response(status_code=204)


@app.put("/api/courses/{course_id}/status", response_model=Course, tags=["plan"])
def set_status(course_id: int, body: PlanUpdate):
    with db.get_conn() as conn:
        _get_or_404(conn, course_id)
        db.set_status(conn, course_id, body.status)
        return db.get_course(conn, course_id)


# ====================================================================== plan / dashboard

@app.get("/api/plan", tags=["plan"], summary="Your plan with ECTS totals and conflicts")
def get_plan() -> dict:
    with db.get_conn() as conn:
        courses = db.list_courses(conn)
    mine = [c for c in courses if c.get("status")]
    totals = {s: sum(c["ects"] for c in mine if c["status"] == s) for s in ("completed", "in_progress", "planned")}
    return {"courses": mine, "totals": totals, "conflicts": planner.find_conflicts(courses)}


@app.get("/api/suggestions", tags=["plan"], summary="Explainable next-course suggestions")
def suggestions(interests: str = Query("", description="Comma-separated keywords, e.g. data,web"), limit: int = 5):
    with db.get_conn() as conn:
        courses = db.list_courses(conn)
    return planner.suggest(courses, [i.strip() for i in interests.split(",")], limit)


@app.get("/api/graph", tags=["plan"], summary="Prerequisite graph (nodes with depth, edges)")
def graph() -> dict:
    with db.get_conn() as conn:
        return planner.prerequisite_graph(db.list_courses(conn))


# ====================================================================== export / import (pass on)

@app.get("/api/export/catalog.jsonld", tags=["pass on"], summary="Whole catalog as a JSON-LD ItemList")
def export_catalog(request: Request):
    with db.get_conn() as conn:
        courses = db.list_courses(conn)
    body = json.dumps(formats.catalog_to_jsonld(courses, base_url(request)), indent=2, ensure_ascii=False)
    return _download(body, JSONLD, "catalog.jsonld")


@app.get("/api/export/plan.jsonld", tags=["pass on"], summary="Your planned/active courses as JSON-LD")
def export_plan_jsonld(request: Request):
    with db.get_conn() as conn:
        courses = [c for c in db.list_courses(conn) if c.get("status")]
    body = json.dumps(formats.catalog_to_jsonld(courses, base_url(request), name="My course plan"), indent=2, ensure_ascii=False)
    return _download(body, JSONLD, "my-plan.jsonld")


@app.get("/api/export/plan.ics", tags=["pass on"], summary="Timetable of planned + in-progress courses")
def export_plan_ics(request: Request):
    with db.get_conn() as conn:
        courses = [c for c in db.list_courses(conn) if c.get("status") in planner.ACTIVE]
    return _download(formats.to_ics(courses, base_url(request), name="My timetable"), ICS, "my-timetable.ics")


@app.post("/api/import", response_model=ImportResult, tags=["pass on"],
          summary="Import JSON-LD (Course, list, @graph or ItemList); upserts by courseCode")
def import_jsonld(
    payload: Any = Body(..., examples=[{"@context": "https://schema.org", "@type": "Course", "courseCode": "X1", "name": "Example"}]),
    as_status: Optional[Status] = Query(None, description="Also add every imported course to your plan with this status"),
):
    result = ImportResult(created=[], updated=[], skipped=[])
    nodes = list(formats.iter_jsonld_courses(payload))
    if not nodes:
        raise HTTPException(422, "No schema.org Course found in the document")
    with db.get_conn() as conn:
        for node in nodes:
            try:
                data = formats.jsonld_to_course(node)
            except ValueError as exc:
                result.skipped.append(f"{formats._text(node.get('name')) or '?'}: {exc}")
                continue
            existing = db.get_course_by_code(conn, data.code)
            if existing:
                db.update_course(conn, existing["id"], data)
                cid = existing["id"]
                result.updated.append(data.code)
            else:
                cid = db.create_course(conn, data)
                result.created.append(data.code)
            if as_status:
                db.set_status(conn, cid, as_status)
    return result


@app.get("/api/qr.svg", tags=["pass on"], summary="QR code (SVG) for any share link")
def qr(data: str = Query(..., max_length=1000)):
    buf = io.BytesIO()
    segno.make(data, error="m").save(buf, kind="svg", scale=6, border=2, dark="#1b1f3b")
    return Response(buf.getvalue(), media_type="image/svg+xml")


# ====================================================================== serve the built frontend (optional)

DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if DIST.is_dir():
    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404)
        target = (DIST / full_path).resolve()
        if full_path and target.is_file() and DIST in target.parents:
            return FileResponse(target)
        return FileResponse(DIST / "index.html")
