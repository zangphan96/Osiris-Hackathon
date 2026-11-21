"""Open-standard formats: iCalendar (RFC 5545) and JSON-LD (schema.org/Course).

This module is the "doorgeven" (pass on) part of the app. Everything here is
pure functions over plain dicts so it can be reused outside the API.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any, Iterable, Iterator, Optional
from zoneinfo import ZoneInfo

from icalendar import Calendar, Event

from .models import WEEKDAYS, CourseIn, SessionIn

TZ_NAME = "Europe/Amsterdam"
TZ = ZoneInfo(TZ_NAME)
SCHEMA = "https://schema.org"
DEFAULT_WEEKS = 10  # used when a course has no end date


# ====================================================================== iCalendar

def _parse_date(value: Optional[str]) -> Optional[date]:
    return date.fromisoformat(value) if value else None


def _first_on_or_after(start: date, weekday: int) -> date:
    return start + timedelta(days=(weekday - start.weekday()) % 7)


def _hm(value: str) -> time:
    h, m = value.split(":")[:2]
    return time(int(h), int(m))


def _course_events(course: dict, base_url: str) -> Iterator[Event]:
    start = _parse_date(course.get("start_date")) or date.today()
    end = _parse_date(course.get("end_date"))
    for s in course.get("sessions", []):
        first = _first_on_or_after(start, s["weekday"])
        ev = Event()
        ev.add("uid", f"{course['code']}-{s.get('id', s['weekday'])}-{s['start_time']}@open-course-companion")
        ev.add("summary", f"{course['code']} {course['title']} – {s['kind']}")
        ev.add("dtstart", datetime.combine(first, _hm(s["start_time"]), tzinfo=TZ))
        ev.add("dtend", datetime.combine(first, _hm(s["end_time"]), tzinfo=TZ))
        ev.add("dtstamp", datetime.now(tz=ZoneInfo("UTC")))
        if s.get("location"):
            ev.add("location", s["location"])
        desc = [course.get("description", "").strip()]
        if course.get("teacher"):
            desc.append(f"Teacher: {course['teacher']}")
        desc.append(f"ECTS: {course.get('ects')}")
        if course.get("id") is not None:
            desc.append(f"{base_url}/courses/{course['id']}")
        ev.add("description", "\n".join(d for d in desc if d))
        ev.add("categories", [course["code"], s["kind"]])
        if end:
            # RFC 5545: with a TZID'd DTSTART, UNTIL must be in UTC.
            until = datetime.combine(end, time(23, 59, 59), tzinfo=TZ).astimezone(ZoneInfo("UTC"))
            ev.add("rrule", {"freq": "weekly", "until": until})
        else:
            ev.add("rrule", {"freq": "weekly", "count": DEFAULT_WEEKS})
        yield ev


def to_ics(courses: Iterable[dict], base_url: str = "", name: str = "Courses") -> bytes:
    cal = Calendar()
    cal.add("prodid", "-//Open Course Companion//UU Osiris Hackathon//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("x-wr-calname", name)
    cal.add("x-wr-timezone", TZ_NAME)
    for course in courses:
        for ev in _course_events(course, base_url):
            cal.add_component(ev)
    if hasattr(cal, "add_missing_timezones"):  # icalendar >= 6: embed VTIMEZONE
        cal.add_missing_timezones()
    return cal.to_ical()


# ====================================================================== JSON-LD export

def course_to_jsonld(course: dict, base_url: str = "", with_context: bool = True) -> dict:
    url = f"{base_url}/courses/{course['id']}" if course.get("id") is not None else None
    doc: dict[str, Any] = {}
    if with_context:
        doc["@context"] = SCHEMA
    doc["@type"] = "Course"
    if url:
        doc["@id"] = url
        doc["url"] = url
    doc.update(
        {
            "courseCode": course["code"],
            "name": course["title"],
            "description": course.get("description", ""),
            "inLanguage": course.get("language") or "en",
            "numberOfCredits": {"@type": "StructuredValue", "value": course.get("ects", 0), "unitText": "ECTS"},
        }
    )
    if course.get("level"):
        doc["educationalLevel"] = course["level"]
    if course.get("provider"):
        doc["provider"] = {"@type": "Organization", "name": course["provider"]}
    if course.get("prerequisites"):
        doc["coursePrerequisites"] = [{"@type": "Course", "courseCode": c} for c in course["prerequisites"]]

    instances = []
    for s in course.get("sessions", []):
        inst: dict[str, Any] = {
            "@type": "CourseInstance",
            "name": s["kind"],
            "courseMode": "onsite",
            "courseSchedule": {
                "@type": "Schedule",
                "byDay": f"{SCHEMA}/{WEEKDAYS[s['weekday']]}",
                "startTime": s["start_time"],
                "endTime": s["end_time"],
                "repeatFrequency": "P1W",
                "scheduleTimezone": TZ_NAME,
            },
        }
        if s.get("location"):
            inst["location"] = {"@type": "Place", "name": s["location"]}
        instances.append(inst)
    if not instances and (course.get("start_date") or course.get("teacher")):
        instances.append({"@type": "CourseInstance", "courseMode": "onsite"})
    for inst in instances:
        if course.get("teacher"):
            inst["instructor"] = {"@type": "Person", "name": course["teacher"]}
        for key, field in (("startDate", "start_date"), ("endDate", "end_date")):
            if course.get(field):
                inst[key] = course[field]
                if "courseSchedule" in inst:
                    inst["courseSchedule"][key] = course[field]
    if instances:
        doc["hasCourseInstance"] = instances
    return doc


def catalog_to_jsonld(courses: Iterable[dict], base_url: str = "", name: str = "Course catalog") -> dict:
    return {
        "@context": SCHEMA,
        "@type": "ItemList",
        "name": name,
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "item": course_to_jsonld(c, base_url, with_context=False)}
            for i, c in enumerate(courses)
        ],
    }


# ====================================================================== JSON-LD import

def _as_list(v: Any) -> list:
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


def _types(obj: dict) -> list[str]:
    return [str(t).split("/")[-1].split(":")[-1] for t in _as_list(obj.get("@type"))]


def _text(v: Any) -> str:
    """Pull a human-readable string out of a Text / Thing / @value."""
    if v is None:
        return ""
    if isinstance(v, list):
        return ", ".join(t for t in (_text(x) for x in v) if t)
    if isinstance(v, dict):
        for key in ("name", "@value", "value", "courseCode", "identifier"):
            if key in v:
                return _text(v[key])
        return ""
    return str(v).strip()


def iter_jsonld_courses(doc: Any) -> Iterator[dict]:
    """Find every schema.org Course in a JSON-LD document (single, list, @graph or ItemList)."""
    for node in _as_list(doc):
        if not isinstance(node, dict):
            continue
        types = _types(node)
        if "Course" in types:
            yield node
        if "@graph" in node:
            yield from iter_jsonld_courses(node["@graph"])
        if "ItemList" in types:
            for el in _as_list(node.get("itemListElement")):
                if isinstance(el, dict) and "item" in el:
                    yield from iter_jsonld_courses(el["item"])
                else:
                    yield from iter_jsonld_courses(el)


def _weekday(v: Any) -> Optional[int]:
    name = _text(v).split("/")[-1].split(":")[-1].strip().capitalize()
    return WEEKDAYS.index(name) if name in WEEKDAYS else None


def _credits(v: Any) -> float:
    if isinstance(v, dict):
        v = v.get("value", v.get("@value", 0))
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def jsonld_to_course(node: dict) -> CourseIn:
    code = _text(node.get("courseCode")) or _text(node.get("identifier"))
    if not code:
        raise ValueError("Course has no courseCode")

    prereqs: list[str] = []
    for p in _as_list(node.get("coursePrerequisites")):
        if isinstance(p, dict):
            c = _text(p.get("courseCode")) or _text(p.get("identifier"))
        else:
            c = _text(p)
            if " " in c:  # free-text prerequisite, not a course code
                c = ""
        if c:
            prereqs.append(c)

    sessions: list[SessionIn] = []
    teacher, start_date, end_date = "", None, None
    for inst in _as_list(node.get("hasCourseInstance")):
        if not isinstance(inst, dict):
            continue
        teacher = teacher or _text(inst.get("instructor"))
        start_date = start_date or (_text(inst.get("startDate"))[:10] or None)
        end_date = end_date or (_text(inst.get("endDate"))[:10] or None)
        for sched in _as_list(inst.get("courseSchedule")):
            if not isinstance(sched, dict):
                continue
            start_date = start_date or (_text(sched.get("startDate"))[:10] or None)
            end_date = end_date or (_text(sched.get("endDate"))[:10] or None)
            st, et = _text(sched.get("startTime"))[:5], _text(sched.get("endTime"))[:5]
            for day in _as_list(sched.get("byDay")):
                wd = _weekday(day)
                if wd is None or not st or not et:
                    continue
                sessions.append(
                    SessionIn(
                        kind=_text(inst.get("name")) or "Lecture",
                        weekday=wd,
                        start_time=st,
                        end_time=et,
                        location=_text(inst.get("location")),
                    )
                )

    return CourseIn(
        code=code,
        title=_text(node.get("name")) or code,
        description=_text(node.get("description")),
        ects=_credits(node.get("numberOfCredits")),
        language=_text(node.get("inLanguage"))[:10] or "en",
        teacher=teacher,
        provider=_text(node.get("provider")),
        level=_text(node.get("educationalLevel")),
        start_date=start_date,
        end_date=end_date,
        prerequisites=prereqs,
        sessions=sessions,
    )
