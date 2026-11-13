import sys
sys.path.append(r"C:\Users\ASUS\.gemini\antigravity\scratch\absent-marker")
import app, re

c = app.app.test_client()
r = c.get("/")
html = r.data.decode()

anchors_itum = re.findall(r"<a[^>]*>.*?ITUM.*?</a>", html, re.DOTALL)
print("Anchor tags containing 'ITUM' in landing (expected 0):", len(anchors_itum))

has_badge_div = "hero-badge" in html
print("hero-badge exists:", has_badge_div)

has_plain_itum = "plain-itum" in html
print("ITUM uses plain-itum span (not anchor):", has_plain_itum)

has_get_started_button = 'id="btn-hero-get-started"' in html
print("Get Started is a button:", has_get_started_button)

has_demo_button = 'id="btn-hero-demo"' in html
print("Demo CTA is a button:", has_demo_button)

# Confirm no text-decoration set on hero-badge in CSS
with open(r"C:\Users\ASUS\.gemini\antigravity\scratch\absent-marker\static\css\style.css", "r") as f:
    css = f.read()

has_no_deco = "text-decoration: none !important;" in css
print("Global text-decoration removal in CSS:", has_no_deco)

all_ok = len(anchors_itum)==0 and has_badge_div and has_plain_itum and has_get_started_button and has_demo_button and has_no_deco
print("\nAll checks passed!" if all_ok else "\nSOME CHECKS FAILED")
