import requests
import json
import sys

BASE_URL = "http://localhost:3001/api/research"

def test_research_api():
    print("🧪 Testing Research Notes API...")
    
    # 1. Create a note
    print("\n1. creating note...")
    note_data = {
        "symbol": "NVDA",
        "content": "Strong demand for Blackwell. Key supply chain checks positive.",
        "forward_pe": 35.5,
        "target_price": 160.0,
        "sentiment": "BULLISH",
        "external_links": [
            {"url": "https://reddit.com/r/hardware/nvda", "title": "Reddit", "source": "Reddit"}
        ]
    }
    
    try:
        response = requests.post(BASE_URL + "/", json=note_data)
        response.raise_for_status()
        created_note = response.json()
        print("✅ Created:", created_note['id'])
    except Exception as e:
        print(f"❌ Create failed: {e}")
        print(response.content if 'response' in locals() else "No response")
        return

    note_id = created_note['id']

    # 2. Get all notes
    print("\n2. Getting all notes...")
    try:
        response = requests.get(BASE_URL + "/")
        notes = response.json()
        found = any(n['id'] == note_id for n in notes)
        if found:
            print("✅ Note found in list")
        else:
            print("❌ Note NOT found in list")
    except Exception as e:
        print(f"❌ Get all failed: {e}")

    # 3. Get specific symbol
    print("\n3. Getting notes for NVDA...")
    try:
        response = requests.get(BASE_URL + "/NVDA")
        notes = response.json()
        if len(notes) > 0 and notes[0]['symbol'] == 'NVDA':
            print("✅ NVDA notes found")
        else:
            print("❌ NVDA notes NOT found")
    except Exception as e:
        print(f"❌ Get symbol failed: {e}")

    # 4. Delete note
    print("\n4. Deleting note...")
    try:
        response = requests.delete(f"{BASE_URL}/{note_id}")
        if response.ok:
            print("✅ Deleted")
        else:
            print("❌ Delete failed")
    except Exception as e:
        print(f"❌ Delete failed: {e}")

if __name__ == "__main__":
    test_research_api()
