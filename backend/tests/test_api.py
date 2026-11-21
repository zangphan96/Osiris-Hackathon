"""End-to-end test of the enter → pass on → show flow. Run: python -m pytest"""
import json
import os
import tempfile
from pathlib import Path

os.environ["OCC_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

from fastapi.testclient import TestClient  # noqa: E402
from icalendar import Calendar  # noqa: E402

from app.main import app  # noqa: E402

NEW = {
    "code": "test101",
    "title": "Testing Things",
    "description": "A course about data and testing.",
    "ects": 5,
    "teacher": "T. Tester",
    "start_date": "2026-09-07",
    "end_date": "2026-10-30",
    "prerequisites": ["INFOB1IMP"],
    "sessions": [{"kind": "Lecture", "weekday": 0, "start_time": "09:30", "end_time": "11:00", "location": "Room 1"}],
}


def test_full_flow():
    with TestClient(app) as client:
        # show: seeded catalog
        courses = client.get("/api/courses").json()
        assert len(courses) >= 8

        # enter
        r = client.post("/api/courses", json=NEW)
        assert r.status_code == 201, r.text
        course = r.json()
        assert course["code"] == "TEST101"
        cid = course["id"]
        assert client.post("/api/courses", json=NEW).status_code == 409

        # validation
        bad = {**NEW, "code": "BAD1", "sessions": [{**NEW["sessions"][0], "end_time": "08:00"}]}
        assert client.post("/api/courses", json=bad).status_code == 422

        # pass on: iCalendar
        r = client.get(f"/api/courses/{cid}.ics")
        assert r.status_code == 200 and r.headers["content-type"].startswith("text/calendar")
        cal = Calendar.from_ical(r.content)
        events = [c for c in cal.walk("VEVENT")]
        assert len(events) == 1
        ev = events[0]
        assert ev.decoded("dtstart").weekday() == 0
        assert str(ev.decoded("dtstart").tzinfo) == "Europe/Amsterdam"
        assert "RRULE" in ev

        # pass on: JSON-LD round trip into a "second copy"
        doc = client.get(f"/api/courses/{cid}.jsonld").json()
        assert doc["@type"] == "Course" and doc["courseCode"] == "TEST101"
        assert doc["hasCourseInstance"][0]["courseSchedule"]["byDay"] == "https://schema.org/Monday"
        client.delete(f"/api/courses/{cid}")
        assert client.get(f"/api/courses/{cid}").status_code == 404
        r = client.post("/api/import?as_status=planned", json=doc)
        assert r.json()["created"] == ["TEST101"]
        restored = next(c for c in client.get("/api/courses?q=TEST101").json())
        assert restored["sessions"][0]["start_time"] == "09:30"
        assert restored["prerequisites"] == ["INFOB1IMP"]
        assert restored["status"] == "planned"
        assert restored["start_date"] == "2026-09-07"

        # catalog export → import is idempotent (updates, no duplicates)
        catalog = client.get("/api/export/catalog.jsonld").json()
        r = client.post("/api/import", json=catalog).json()
        assert r["created"] == [] and len(r["updated"]) == len(catalog["itemListElement"])

        # show: plan, conflicts, suggestions, graph
        plan = client.get("/api/plan").json()
        assert plan["totals"]["completed"] == 15
        assert any(c["type"] == "schedule" for c in plan["conflicts"])  # seeded Monday 11:00 clash
        sugg = client.get("/api/suggestions?interests=web").json()
        assert sugg and sugg[0]["course"]["code"] == "INFOB2WEB"
        graph = client.get("/api/graph").json()
        assert {"from": "INFOB1IMP", "to": "INFOB1DB"} in graph["edges"]

        # a file produced by "another system" (@graph, byDay list, HH:MM:SS times)
        ext = json.loads((Path(__file__).parents[2] / "examples" / "external-course.jsonld").read_text("utf-8"))
        r = client.post("/api/import", json=ext).json()
        assert r["created"] == ["EXT-HCI"]
        hci = client.get("/api/courses?q=EXT-HCI").json()[0]
        assert [s["weekday"] for s in hci["sessions"]] == [1, 3]
        assert hci["sessions"][0]["start_time"] == "10:00" and hci["teacher"] == "Dr. P. Example"
        assert client.post("/api/import", json={"hello": "world"}).status_code == 422

        assert client.get("/api/export/plan.ics").status_code == 200
        assert client.get("/api/qr.svg", params={"data": "http://x"}).text.startswith("<?xml")
        assert client.get("/openapi.json").status_code == 200
