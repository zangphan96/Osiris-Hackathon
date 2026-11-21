"""Pydantic models shared by the API."""
from __future__ import annotations

import re
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

Status = Literal["planned", "in_progress", "completed"]


class SessionIn(BaseModel):
    kind: str = Field("Lecture", max_length=60, description="e.g. Lecture, Werkcollege, Lab")
    weekday: int = Field(..., ge=0, le=6, description="0 = Monday … 6 = Sunday")
    start_time: str = Field(..., examples=["09:00"])
    end_time: str = Field(..., examples=["10:45"])
    location: str = Field("", max_length=200)

    @field_validator("start_time", "end_time")
    @classmethod
    def _check_time(cls, v: str) -> str:
        if not TIME_RE.match(v):
            raise ValueError("time must be HH:MM (24h)")
        return v

    @field_validator("end_time")
    @classmethod
    def _end_after_start(cls, v: str, info):
        start = info.data.get("start_time")
        if start and v <= start:
            raise ValueError("end_time must be after start_time")
        return v


class Session(SessionIn):
    id: int


class CourseIn(BaseModel):
    code: str = Field(..., min_length=2, max_length=30, examples=["INFOB2DA"])
    title: str = Field(..., min_length=2, max_length=200)
    description: str = ""
    ects: float = Field(7.5, ge=0, le=60)
    language: str = Field("en", max_length=10)
    teacher: str = ""
    provider: str = "Universiteit Utrecht"
    level: str = Field("", description="e.g. Bachelor 1, Master")
    start_date: Optional[str] = Field(None, description="ISO date YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="ISO date YYYY-MM-DD")
    prerequisites: list[str] = Field(default_factory=list, description="Course codes")
    sessions: list[SessionIn] = Field(default_factory=list)

    @field_validator("code")
    @classmethod
    def _norm_code(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("prerequisites")
    @classmethod
    def _norm_prereqs(cls, v: list[str]) -> list[str]:
        seen: list[str] = []
        for code in v:
            c = code.strip().upper()
            if c and c not in seen:
                seen.append(c)
        return seen

    @field_validator("start_date", "end_date")
    @classmethod
    def _check_date(cls, v: Optional[str]) -> Optional[str]:
        if v in (None, ""):
            return None
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("date must be YYYY-MM-DD")
        return v


class Course(CourseIn):
    id: int
    sessions: list[Session] = Field(default_factory=list)
    status: Optional[Status] = None
    created_at: str
    updated_at: str


class PlanUpdate(BaseModel):
    status: Optional[Status] = Field(None, description="null removes the course from your plan")


class ImportResult(BaseModel):
    created: list[str]
    updated: list[str]
    skipped: list[str]
