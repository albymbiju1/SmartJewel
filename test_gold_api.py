import requests

api_key = "goldapi-120fkismfp5fpuj-io"
url = "https://www.goldapi.io/api/XAU/INR"
headers = {
    "x-access-token": api_key,
    "Content-Type": "application/json",
}

try:
    resp = requests.get(url, headers=headers, timeout=20)
    print(f"Status: {resp.status_code}")
    if resp.status_code >= 400:
        print(f"Body: {resp.text[:200]}")
    else:
        data = resp.json()
        print(f"Data: {data}")
        g24 = data.get("price_gram_24k")
        print(f"24k price per gram: {g24}")
except Exception as e:
    print(f"Error: {e}")