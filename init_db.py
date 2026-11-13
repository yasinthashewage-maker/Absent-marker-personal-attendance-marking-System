"""
init_db.py — Database Initialization Script
ABSENT MARKER | ITUM Student Attendance Portal
Semester 3, Week 12

Creates attendance.db with all schema tables and seeds demo data.
Run once: python init_db.py
"""

import sqlite3
import os
import random
from datetime import date, timedelta
from werkzeug.security import generate_password_hash

# ─────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "attendance.db")

# ─────────────────────────────────────────────
#  Schema DDL
# ─────────────────────────────────────────────
SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS students (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name     TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    reg_number    TEXT UNIQUE,
    department    TEXT DEFAULT 'Division of Information Technology',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS modules (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    code     TEXT UNIQUE NOT NULL,
    name     TEXT NOT NULL,
    credits  INTEGER NOT NULL,
    semester INTEGER DEFAULT 3
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  INTEGER NOT NULL REFERENCES students(id),
    module_id   INTEGER NOT NULL REFERENCES modules(id),
    date        TEXT NOT NULL,
    status      TEXT NOT NULL CHECK(status IN ('present','absent','no_class')),
    is_medical  INTEGER DEFAULT 0,
    mc_reference TEXT,
    notes       TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, module_id, date)
);

CREATE TABLE IF NOT EXISTS medical_certificates (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id   INTEGER NOT NULL REFERENCES students(id),
    module_id    INTEGER NOT NULL REFERENCES modules(id),
    date         TEXT NOT NULL,
    mc_reference TEXT NOT NULL,
    verified     INTEGER DEFAULT 0,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

# ─────────────────────────────────────────────
#  Seed Data — Modules
# ─────────────────────────────────────────────
MODULES = [
    ("IT2101", "Engineering Mathematics III",              3),
    ("IT2102", "Web Application Development",              3),
    ("IT2103", "Object Oriented Analysis and Design",      3),
    ("IT2104", "Data Communication and Computer Networks", 3),
    ("IT2105", "Software Engineering and Lifecycle",       3),
    ("IT2106", "Digital Electronics and Microprocessors",  3),
    ("IT2107", "Object Oriented Programming in Java",      3),
    ("IT2108", "Digital Forensics and Cyber Security",     3),
    ("CM2101", "Professional English and Communication",   2),
    ("CM2102", "Aesthetic Studies and Social Ethics",      2),
]

# ─────────────────────────────────────────────
#  Seed Data — Attendance Configuration per module
#
#  Each entry: (total_absences, mc_absences_count)
#  out of exactly 32 conducted sessions (weekday dates Sep1–Nov12 2026).
#
#  Target attendance percentages:
#    Most modules  : ≥ 86%  (≤4 unexcused absences out of 32)
#    IT2103 (idx 2): ~82%   (borderline — 6 total absences, 1 MC → pct=27/31=87%…
#                            tweaked: 6 abs, 0 MC → pct=26/32=81.25% Warning)
#    IT2106 (idx 5): ~74%   (critical   — 9 abs, 1 MC → effective=31, pct=23/31=74.2%)
#    IT2108 (idx 7): ~76%   (critical   — 8 abs, 2 MC → effective=30, pct=24/30=80% Warning;
#                            use 10 abs, 2 MC → effective=30, pct=22/30=73.3% Critical)
# ─────────────────────────────────────────────
# (total_absences, mc_absences_count)  mc absences reduce effective total
# Attendance pct = (32 - total_absences) / (32 - mc_absences) * 100
MODULE_ABSENCE_CONFIG = {
    "IT2101": (4,  1),  # present=28, effective=31, pct=90.3%  Eligible
    "IT2102": (4,  0),  # present=28, effective=32, pct=87.5%  Eligible
    "IT2103": (6,  1),  # present=26, effective=31, pct=83.9%  Warning  (~82% borderline)
    "IT2104": (4,  1),  # present=28, effective=31, pct=90.3%  Eligible
    "IT2105": (3,  0),  # present=29, effective=32, pct=90.6%  Eligible
    "IT2106": (9,  1),  # present=23, effective=31, pct=74.2%  Critical
    "IT2107": (4,  0),  # present=28, effective=32, pct=87.5%  Eligible
    "IT2108": (10, 2),  # present=22, effective=30, pct=73.3%  Critical  (~76% target)
    "CM2101": (4,  0),  # present=28, effective=32, pct=87.5%  Eligible
    "CM2102": (4,  1),  # present=28, effective=31, pct=90.3%  Eligible
}


def get_weekdays(start: date, end: date):
    """Return list of weekday date strings between start and end (inclusive)."""
    days = []
    current = start
    while current <= end:
        # 0=Mon … 4=Fri; skip Sat(5) and Sun(6)
        if current.weekday() < 5:
            days.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    return days


def seed_attendance(conn, student_id: int, module_id: int, code: str):
    """
    Generate exactly 32 conducted sessions for the module and insert attendance records.
    Uses the per-module absence config to hit the required attendance percentages.

    Strategy: take all weekdays Sep 1 – Nov 12 (≈55 days) and pick 32 of them,
    offset per module so each module uses a slightly different subset (simulating
    different scheduled lecture slots).
    """
    start  = date(2026, 9, 1)
    end    = date(2026, 11, 12)
    all_weekdays = get_weekdays(start, end)

    # Stagger the starting offset per module so not every module picks the same days
    offset   = (module_id - 1) % 5
    # Pick every other day starting from offset to get ~32 within the range
    candidate = all_weekdays[offset::2]
    sessions  = candidate[:32]   # exactly 32 sessions

    # Determine total absences and how many are MC-covered
    total_absences, mc_count = MODULE_ABSENCE_CONFIG.get(code, (4, 0))
    conducted = len(sessions)   # always 32

    # Pick which session indices will be absences
    random.seed(module_id * 100)  # deterministic per module
    absent_indices = sorted(random.sample(range(conducted), min(total_absences, conducted)))

    # First mc_count absent indices are medical
    mc_indices = set(absent_indices[:mc_count])

    mc_serial = 1000 + module_id * 10  # unique-ish MC serial

    rows = []
    for i, day in enumerate(sessions):
        if i in mc_indices:
            mc_ref = f"MC-ITUM-2026-{mc_serial:04d}"
            mc_serial += 1
            rows.append((student_id, module_id, day, "absent", 1, mc_ref, "Medical leave"))
        elif i in set(absent_indices):
            rows.append((student_id, module_id, day, "absent", 0, None, None))
        else:
            rows.append((student_id, module_id, day, "present", 0, None, None))

    conn.executemany(
        """INSERT OR IGNORE INTO attendance_records
           (student_id, module_id, date, status, is_medical, mc_reference, notes)
           VALUES (?,?,?,?,?,?,?)""",
        rows
    )

    # Also insert medical_certificates rows for the MC absences
    mc_rows = [
        (student_id, module_id, row[2], row[5])
        for row in rows if row[4] == 1  # is_medical
    ]
    if mc_rows:
        conn.executemany(
            """INSERT OR IGNORE INTO medical_certificates
               (student_id, module_id, date, mc_reference)
               VALUES (?,?,?,?)""",
            mc_rows
        )


def init_db():
    # Remove old DB so we always get a clean seed
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f"[init_db] Removed existing {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    print("[init_db] Creating schema …")
    conn.executescript(SCHEMA)

    # ── Seed student ──────────────────────────────────────────────────────────
    print("[init_db] Seeding students …")
    conn.execute(
        """INSERT OR IGNORE INTO students (full_name, email, password_hash, reg_number)
           VALUES (?, ?, ?, ?)""",
        (
            "Yasintha Perera",
            "yasintha@student.itum.mrt.ac.lk",
            generate_password_hash("password123"),
            "IT/22/S3/001",
        ),
    )
    conn.execute(
        """INSERT OR IGNORE INTO students (full_name, email, password_hash, reg_number)
           VALUES (?, ?, ?, ?)""",
        (
            "Sadee Wickramasinghe",
            "sadee.itum@gmail.com",
            generate_password_hash("sadee2026"),
            "ITUM/NDT/2024/IT/042",
        ),
    )

    # ── Seed modules ─────────────────────────────────────────────────────────
    print("[init_db] Seeding modules …")
    conn.executemany(
        "INSERT OR IGNORE INTO modules (code, name, credits) VALUES (?,?,?)",
        MODULES,
    )
    conn.commit()

    modules_rows = conn.execute("SELECT id, code FROM modules ORDER BY id").fetchall()

    # ── Seed attendance records ───────────────────────────────────────────────
    print("[init_db] Seeding attendance records …")
    for s_email in ["yasintha@student.itum.mrt.ac.lk", "sadee.itum@gmail.com"]:
        s_row = conn.execute("SELECT id FROM students WHERE email=?", (s_email,)).fetchone()
        if s_row:
            s_id = s_row["id"]
            for m in modules_rows:
                seed_attendance(conn, s_id, m["id"], m["code"])

    conn.commit()
    conn.close()

    # ── Verification ─────────────────────────────────────────────────────────
    print("\n[init_db] ✅ Done. Verification:")
    conn2 = sqlite3.connect(DB_PATH)
    conn2.row_factory = sqlite3.Row

    student_count = conn2.execute("SELECT COUNT(*) as n FROM students").fetchone()["n"]
    module_count  = conn2.execute("SELECT COUNT(*) as n FROM modules").fetchone()["n"]
    record_count  = conn2.execute("SELECT COUNT(*) as n FROM attendance_records").fetchone()["n"]
    mc_count_db   = conn2.execute("SELECT COUNT(*) as n FROM medical_certificates").fetchone()["n"]

    print(f"  students           : {student_count}")
    print(f"  modules            : {module_count}")
    print(f"  attendance_records : {record_count}")
    print(f"  medical_certs      : {mc_count_db}")

    # Quick attendance % per module
    print("\n  Attendance summary (pre-seeded):")
    rows = conn2.execute("""
        SELECT m.code, m.name,
               COUNT(*) as conducted,
               SUM(CASE WHEN ar.status='present' THEN 1 ELSE 0 END) as present,
               SUM(CASE WHEN ar.status='absent' AND ar.is_medical=0 THEN 1 ELSE 0 END) as unexcused,
               SUM(CASE WHEN ar.status='absent' AND ar.is_medical=1 THEN 1 ELSE 0 END) as mc_abs
        FROM modules m
        JOIN attendance_records ar ON ar.module_id=m.id
        GROUP BY m.id
        ORDER BY m.id
    """).fetchall()

    for r in rows:
        effective = r["conducted"] - r["mc_abs"]
        pct = (r["present"] / effective * 100) if effective else 0
        status = "Eligible" if pct >= 85 else ("Warning" if pct >= 80 else "Critical")
        print(f"  [{status:8s}] {r['code']} | {pct:.1f}% | "
              f"present={r['present']}, unexcused={r['unexcused']}, mc={r['mc_abs']}, "
              f"effective={effective}/{r['conducted']}")

    conn2.close()
    print(f"\n[init_db] Database saved at: {DB_PATH}")


if __name__ == "__main__":
    init_db()
