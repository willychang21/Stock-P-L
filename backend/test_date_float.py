import datetime
try:
    datetime.date(2023.0, 1, 1)
except Exception as e:
    print(f"datetime.date(float): {e}")

try:
    datetime.date(2023, 1.0, 1)
except Exception as e:
    print(f"datetime.date(int, float, int): {e}")
