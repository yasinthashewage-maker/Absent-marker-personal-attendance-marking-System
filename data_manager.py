"""
ABSENT MARKER - Data Store & Calculation Engine
"""
import json, os
from datetime import datetime

DATA_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(DATA_DIR, "data", "attendance_store.json")

DEFAULT_MODULES = [
    {"id":"maths","name":"Maths","fullName":"Engineering Mathematics III","code":"IT2101","scheduledDays":[1,4],"timeSlots":{"1":"08:30 - 10:30","4":"08:30 - 10:30"},"plannedSessions":15,"credits":3},
    {"id":"web_tech","name":"Web Tech","fullName":"Web Application Development","code":"IT2102","scheduledDays":[1,4],"timeSlots":{"1":"10:45 - 12:45","4":"10:45 - 12:45"},"plannedSessions":15,"credits":3},
    {"id":"ooad","name":"OOAD","fullName":"Object-Oriented Analysis & Design","code":"IT2103","scheduledDays":[1,5],"timeSlots":{"1":"01:30 - 03:30","5":"10:45 - 12:45"},"plannedSessions":15,"credits":3},
    {"id":"network","name":"Network","fullName":"Data Communication & Computer Networks","code":"IT2104","scheduledDays":[2,5],"timeSlots":{"2":"08:30 - 10:30","5":"08:30 - 10:30"},"plannedSessions":15,"credits":3},
    {"id":"se","name":"SE","fullName":"Software Engineering & Lifecycle","code":"IT2105","scheduledDays":[2],"timeSlots":{"2":"10:45 - 12:45"},"plannedSessions":15,"credits":3},
    {"id":"digital_elec","name":"Digital Electronics","fullName":"Digital Electronics & Microprocessors","code":"IT2106","scheduledDays":[2],"timeSlots":{"2":"01:30 - 04:30"},"plannedSessions":15,"credits":4},
    {"id":"oop","name":"OOP","fullName":"Object Oriented Programming in Java","code":"IT2107","scheduledDays":[3,5],"timeSlots":{"3":"08:30 - 10:30","5":"01:30 - 03:30"},"plannedSessions":15,"credits":3},
    {"id":"digital_forensic","name":"Digital Forensic","fullName":"Digital Forensics & Cyber Security","code":"IT2108","scheduledDays":[3],"timeSlots":{"3":"10:45 - 12:45"},"plannedSessions":15,"credits":3},
    {"id":"english","name":"English","fullName":"Professional English & Communication","code":"CM2101","scheduledDays":[3],"timeSlots":{"3":"01:30 - 03:30"},"plannedSessions":15,"credits":2},
    {"id":"aesthetic","name":"Aesthetic","fullName":"Aesthetic Studies & Social Ethics","code":"CM2102","scheduledDays":[4],"timeSlots":{"4":"01:30 - 03:30"},"plannedSessions":15,"credits":2},
]

PUBLIC_HOLIDAYS_2026 = {
    "2026-10-25":"Vap Full Moon Poya Day",
    "2026-11-08":"Deepavali Festival Day",
    "2026-11-24":"Il Full Moon Poya Day",
    "2026-12-25":"Christmas Day",
}

def generate_initial_data():
    attendance_logs = {
        "2026-11-02":{"date":"2026-11-02","notes":"","records":{"maths":{"status":"present","isMedical":False},"web_tech":{"status":"present","isMedical":False},"ooad":{"status":"present","isMedical":False}}},
        "2026-11-03":{"date":"2026-11-03","notes":"","records":{"network":{"status":"present","isMedical":False},"se":{"status":"present","isMedical":False},"digital_elec":{"status":"present","isMedical":False}}},
        "2026-11-04":{"date":"2026-11-04","notes":"","records":{"oop":{"status":"present","isMedical":False},"digital_forensic":{"status":"present","isMedical":False},"english":{"status":"present","isMedical":False}}},
        "2026-11-05":{"date":"2026-11-05","notes":"","records":{"maths":{"status":"present","isMedical":False},"web_tech":{"status":"present","isMedical":False},"aesthetic":{"status":"present","isMedical":False}}},
        "2026-11-06":{"date":"2026-11-06","notes":"","records":{"network":{"status":"present","isMedical":False},"ooad":{"status":"present","isMedical":False},"oop":{"status":"present","isMedical":False}}},
        "2026-11-09":{"date":"2026-11-09","notes":"MC submitted for OOAD","records":{"maths":{"status":"present","isMedical":False},"web_tech":{"status":"present","isMedical":False},"ooad":{"status":"absent","isMedical":True,"mcRef":"MC-ITUM-2026-1109"}}},
        "2026-11-10":{"date":"2026-11-10","notes":"","records":{"network":{"status":"present","isMedical":False},"se":{"status":"present","isMedical":False},"digital_elec":{"status":"present","isMedical":False}}},
        "2026-11-11":{"date":"2026-11-11","notes":"","records":{"oop":{"status":"present","isMedical":False},"digital_forensic":{"status":"present","isMedical":False},"english":{"status":"present","isMedical":False}}},
    }
    base_aggregates = {
        "maths":          {"present":10,"unexcused":1,"safe":0},
        "web_tech":       {"present":9,"unexcused":1,"safe":1},
        "ooad":           {"present":9,"unexcused":2,"safe":1},
        "network":        {"present":10,"unexcused":1,"safe":0},
        "se":             {"present":10,"unexcused":1,"safe":0},
        "digital_elec":   {"present":8,"unexcused":2,"safe":1},
        "oop":            {"present":11,"unexcused":1,"safe":0},
        "digital_forensic":{"present":10,"unexcused":1,"safe":0},
        "english":        {"present":11,"unexcused":0,"safe":0},
        "aesthetic":      {"present":10,"unexcused":0,"safe":1},
    }
    return {
        "user":{"name":"Sadee","fullName":"Sadee Wickramasinghe","email":"sadee.itum@gmail.com","studentId":"ITUM/NDT/2024/IT/042","batch":"NDT 2024/2026","department":"Division of Information Technology","institution":"Institute of Technology, University of Moratuwa (ITUM)","semester":3,"currentWeek":12,"totalWeeks":15,"threshold":80.0},
        "modules": DEFAULT_MODULES,
        "base_aggregates": base_aggregates,
        "attendance_logs": attendance_logs,
        "holidays": PUBLIC_HOLIDAYS_2026,
    }

def load_data():
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    if not os.path.exists(DATA_FILE):
        d = generate_initial_data(); save_data(d); return d
    try:
        with open(DATA_FILE,"r",encoding="utf-8") as f: return json.load(f)
    except Exception:
        d = generate_initial_data(); save_data(d); return d

def save_data(data):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE,"w",encoding="utf-8") as f: json.dump(data,f,indent=2,ensure_ascii=False)

def calculate_module_stats(data):
    modules   = data.get("modules", DEFAULT_MODULES)
    base      = data.get("base_aggregates", {})
    threshold = data.get("user",{}).get("threshold",80.0)
    stats     = []
    pct_sum   = 0
    risk_count= 0
    total_safe= 0
    total_unex= 0
    total_pres= 0
    total_cond= 0
    for mod in modules:
        m_id = mod["id"]
        b    = base.get(m_id,{"present":0,"unexcused":0,"safe":0})
        present   = b.get("present",0)
        unexcused = b.get("unexcused",0)
        safe      = b.get("safe",0)
        conducted = present + unexcused + safe
        planned   = mod.get("plannedSessions",15)
        eff_cond  = max(0, conducted - safe)
        eff_pct   = round((present/eff_cond)*100,1) if eff_cond>0 else 100.0
        raw_pct   = round((present/conducted)*100,1) if conducted>0 else 100.0
        is_eligible = eff_pct >= threshold
        if eff_pct < threshold:          risk_status,risk_label="critical","Ineligible / Critical"; risk_count+=1
        elif eff_pct < 85.0:             risk_status,risk_label="warning","Borderline / Warning";  risk_count+=1
        else:                            risk_status,risk_label="safe","Safe / Eligible"
        absences_left = max(0, int(planned*0.20) - unexcused)
        pct_sum    += eff_pct
        total_safe += safe; total_unex += unexcused
        total_pres += present; total_cond += conducted
        stats.append({"id":m_id,"name":mod["name"],"fullName":mod["fullName"],"code":mod["code"],"credits":mod.get("credits",3),"plannedSessions":planned,"conductedSessions":conducted,"presentSessions":present,"unexcusedAbsents":unexcused,"safeAbsents":safe,"effectiveSessions":eff_cond,"effectivePercentage":eff_pct,"rawPercentage":raw_pct,"isEligible":is_eligible,"riskStatus":risk_status,"riskLabel":risk_label,"absencesLeft":absences_left,"scheduledDays":mod.get("scheduledDays",[]),"timeSlots":mod.get("timeSlots",{})})
    n = max(1,len(modules))
    return {"modules":stats,"summary":{"overallAttendance":round(pct_sum/n,1),"totalModules":len(modules),"eligibleModules":sum(1 for s in stats if s["isEligible"]),"riskModulesCount":risk_count,"totalSafeAbsents":total_safe,"totalUnexcusedAbsents":total_unex,"totalPresent":total_pres,"totalConducted":total_cond,"threshold":threshold,"currentWeek":data.get("user",{}).get("currentWeek",12),"totalWeeks":data.get("user",{}).get("totalWeeks",15)}}

def update_attendance_for_date(date_str, records, notes=""):
    data = load_data()
    prev_records = data.get("attendance_logs",{}).get(date_str,{}).get("records",{})
    base = data.get("base_aggregates",{})
    for mod_id, new_rec in records.items():
        if mod_id not in base: base[mod_id]={"present":0,"unexcused":0,"safe":0}
        if mod_id in prev_records:
            old = prev_records[mod_id]
            if old.get("status")=="present": base[mod_id]["present"]=max(0,base[mod_id]["present"]-1)
            elif old.get("status")=="absent":
                if old.get("isMedical"): base[mod_id]["safe"]=max(0,base[mod_id]["safe"]-1)
                else:                    base[mod_id]["unexcused"]=max(0,base[mod_id]["unexcused"]-1)
        s = new_rec.get("status")
        if s=="present":   base[mod_id]["present"]+=1
        elif s=="absent":
            if new_rec.get("isMedical"): base[mod_id]["safe"]+=1
            else:                        base[mod_id]["unexcused"]+=1
    data["base_aggregates"]=base
    data.setdefault("attendance_logs",{})[date_str]={"date":date_str,"notes":notes,"updatedAt":datetime.now().isoformat(),"records":records}
    save_data(data)
    return calculate_module_stats(data)
