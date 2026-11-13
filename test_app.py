import sys
sys.path.append(r"C:\Users\ASUS\.gemini\antigravity\scratch\absent-marker")
import app, data_manager

def run_tests():
    print("🧪 Running tests...")
    client = app.app.test_client()

    # Index HTML check
    res = client.get("/")
    assert res.status_code == 200
    html = res.data.decode("utf-8")
    assert "ABSENT MARKER" in html
    assert "Percentage of attendance" in html
    assert "Medical Certificate log" in html
    assert "Early Warning" in html
    assert "80% EXAM ELIGIBILITY CUTOFF" in html
    assert "demo" not in html.lower(), "Found unexpected 'demo' text in HTML!"
    print("✅ Index HTML test passed (Zero 'demo' text found).")

    # API /api/stats
    res = client.get("/api/stats")
    assert res.status_code == 200
    stats = res.get_json()
    assert len(stats["data"]["modules"]) == 10
    print(f"✅ Calculation Engine verified: 10 modules, Overall Attendance: {stats['data']['summary']['overallAttendance']}%.")

    # Calendar API
    res = client.get("/api/calendar?year=2026&month=11")
    assert res.status_code == 200
    cal = res.get_json()
    assert cal["monthName"] == "November"
    print("✅ Calendar API passed.")

    # Day details
    res = client.get("/api/attendance/day/2026-11-09")
    assert res.status_code == 200
    print("✅ Day API passed.")

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
