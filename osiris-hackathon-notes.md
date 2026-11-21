# Osiris Hackathon – Brainstorm Notes

## The brief (UU)
> Bouw samen met andere UU-studenten een applicatie die gebruikt kan worden voor het **invoeren, doorgeven en tonen** van cursusinformatie. De applicatie is origineel, gebruiksvriendelijk, en gebruikt open standaarden.
>
> Waarom: voor minder afhankelijkheid van grote digitale systemen.

- **Invoeren** = enter course information (e.g. a teacher adds a course)
- **Doorgeven** = pass on / forward / transmit it to other people or systems (*not* "pass a course")
- **Tonen** = show it clearly to whoever needs it

Judges will mainly look for a smooth **enter → pass on → show** flow built on **open standards**.

## Concept: "Open Course Companion"
A student-owned course app where data is **portable by design**: it can be exported in open formats any tool can read, so no single system (Osiris or ours) is the gatekeeper.

1. **Enter:** a simple form to add a course (title, description, ECTS, schedule, prerequisites).
2. **Pass on:** export or share in open formats:
   - `.ics` (iCalendar) for timetables, which works in Google, Outlook and Apple calendars
   - JSON-LD using `schema.org/Course` for course data
   - a shareable link or QR code
3. **Show:** clean course pages and a dashboard (timetable, progress, prerequisite tree).
4. **Optional AI extra:** suggest next courses based on completed courses, requirements and interests, and flag schedule or prerequisite conflicts.

**Portability test:** if the app disappeared tomorrow, would you still have your data in a form other tools can use?

**Demo idea:** export a course or plan, import it into a normal calendar app on stage, then load the same file into a second copy of the app.

## Tech stack (team knows React, JS, Python, SQL)
| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite | Known, fast setup |
| Styling | Tailwind CSS or plain CSS | Quick, clean UI |
| Backend | Python + FastAPI | Auto-generated OpenAPI docs at `/docs` (itself an open standard) |
| Database | SQLite | Plain SQL, no server; can move to PostgreSQL later |
| Open formats | `icalendar` Python library, JSON-LD (`schema.org/Course`) | The "doorgeven" part |

Flow mapping:
- Enter: React form → FastAPI → SQLite
- Pass on: `/courses/{id}.ics`, `/courses/{id}.json` (JSON-LD), share link or QR
- Show: React pages reading from the API

Alternatives: Next.js + SQLite (all JavaScript), or FastAPI + Jinja / Streamlit (all Python, less polished).

## Next step
Scaffold the project: `frontend/` (React + Vite) and `backend/` (FastAPI + SQLite), with minimal working versions of enter, pass on and show. Then add styling, the AI suggester and polish.
