"""Sample data so the demo has something to show. Course codes are fictional examples."""
from __future__ import annotations

from .models import CourseIn, SessionIn

S = SessionIn

SAMPLE_COURSES = [
    CourseIn(
        code="INFOB1IMP",
        title="Imperative Programming",
        description="Learn to program in Python: variables, control flow, functions, data structures and testing.",
        ects=7.5, teacher="Dr. A. de Vries", level="Bachelor 1",
        start_date="2026-09-01", end_date="2026-11-06",
        sessions=[S(kind="Lecture", weekday=0, start_time="09:00", end_time="10:45", location="Ruppert Blauw"),
                  S(kind="Lab", weekday=2, start_time="13:15", end_time="15:00", location="BBG 1.75")],
    ),
    CourseIn(
        code="INFOB1DM",
        title="Discrete Mathematics",
        description="Logic, sets, relations, graphs and proof techniques for computer science.",
        ects=7.5, teacher="Prof. M. Jansen", level="Bachelor 1",
        start_date="2026-09-01", end_date="2026-11-06",
        sessions=[S(kind="Lecture", weekday=1, start_time="11:00", end_time="12:45", location="Educatorium Alfa"),
                  S(kind="Werkcollege", weekday=3, start_time="09:00", end_time="10:45", location="Minnaert 2.02")],
    ),
    CourseIn(
        code="INFOB1DB",
        title="Databases",
        description="Relational data modelling, SQL, normalisation and transactions. Hands-on with SQLite and PostgreSQL.",
        ects=7.5, teacher="Dr. S. Bakker", level="Bachelor 1",
        start_date="2026-11-16", end_date="2027-02-05",
        prerequisites=["INFOB1IMP"],
        sessions=[S(kind="Lecture", weekday=0, start_time="11:00", end_time="12:45", location="Ruppert 040"),
                  S(kind="Lab", weekday=3, start_time="13:15", end_time="15:00", location="BBG 0.13")],
    ),
    CourseIn(
        code="INFOB2DS",
        title="Data Structures",
        description="Lists, trees, hash tables, heaps and graphs; complexity analysis of algorithms.",
        ects=7.5, teacher="Dr. L. Visser", level="Bachelor 2",
        start_date="2026-11-16", end_date="2027-02-05",
        prerequisites=["INFOB1IMP", "INFOB1DM"],
        sessions=[S(kind="Lecture", weekday=0, start_time="11:00", end_time="12:45", location="Educatorium Gamma"),
                  S(kind="Werkcollege", weekday=4, start_time="09:00", end_time="10:45", location="Minnaert 2.01")],
    ),
    CourseIn(
        code="INFOB2WEB",
        title="Web Technology",
        description="HTML, CSS, JavaScript, React, REST APIs and open web standards. Build and deploy a full-stack web app.",
        ects=7.5, teacher="Dr. K. Smit", level="Bachelor 2",
        start_date="2027-02-08", end_date="2027-04-16",
        prerequisites=["INFOB1IMP"],
        sessions=[S(kind="Lecture", weekday=1, start_time="13:15", end_time="15:00", location="Ruppert Rood"),
                  S(kind="Lab", weekday=3, start_time="15:15", end_time="17:00", location="BBG 1.75")],
    ),
    CourseIn(
        code="INFOB2ML",
        title="Introduction to Machine Learning",
        description="Supervised and unsupervised learning, model evaluation, and an introduction to neural networks and AI ethics.",
        ects=7.5, teacher="Prof. R. Hendriks", level="Bachelor 2",
        start_date="2027-02-08", end_date="2027-04-16",
        prerequisites=["INFOB2DS", "INFOB1DB"],
        sessions=[S(kind="Lecture", weekday=2, start_time="09:00", end_time="10:45", location="Educatorium Alfa"),
                  S(kind="Lab", weekday=4, start_time="11:00", end_time="12:45", location="BBG 0.13")],
    ),
    CourseIn(
        code="INFOB3DV",
        title="Data Visualisation",
        description="Perception, visual encoding and interactive dashboards with D3 and Python. Communicating data responsibly.",
        ects=7.5, teacher="Dr. E. Mulder", level="Bachelor 3",
        start_date="2027-04-19", end_date="2027-06-25",
        prerequisites=["INFOB1DB"],
        sessions=[S(kind="Lecture", weekday=1, start_time="09:00", end_time="10:45", location="Ruppert Wit")],
    ),
    CourseIn(
        code="INFOB3OS",
        title="Open Standards & Digital Sovereignty",
        description="Why open standards matter: interoperability, vendor lock-in, iCalendar, JSON-LD, linked data and public-sector IT.",
        ects=5, teacher="Dr. J. Willems", level="Bachelor 3", language="nl",
        start_date="2027-04-19", end_date="2027-06-25",
        prerequisites=["INFOB2WEB"],
        sessions=[S(kind="Seminar", weekday=3, start_time="13:15", end_time="15:00", location="Drift 25 0.32")],
    ),
]

SAMPLE_PLAN = {"INFOB1IMP": "completed", "INFOB1DM": "completed", "INFOB1DB": "in_progress", "INFOB2DS": "planned"}
