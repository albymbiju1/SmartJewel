import requests
import json

# Test the chatbot endpoint with gold price queries
def test_gold_price_queries():
    url = "http://localhost:8000/catalog/chat"
    
    # Test cases specifically for gold price queries
    test_cases = [
        "What is the price of 1 gram gold?",
        "What is the gold rate today?",
        "How much is 1 gram of 22K gold?",
        "What is the current rate of gold?",
        "Price of gold per gram"
    ]
    
    headers = {"Content-Type": "application/json"}
    
    print("Testing gold price queries with chatbot...")
    
    for i, message in enumerate(test_cases, 1):
        print(f"\n--- Test Case {i}: {message} ---")
        payload = {"message": message}
        
        try:
            response = requests.post(url, headers=headers, data=json.dumps(payload))
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {data['reply']}")
                print(f"Intent: {data['intent']}")
            else:
                print(f"Error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"Exception: {str(e)}")

if __name__ == "__main__":
    test_gold_price_queries()