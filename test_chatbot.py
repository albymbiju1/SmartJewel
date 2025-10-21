import requests
import json

# Test the chatbot endpoint
def test_chatbot():
    url = "http://localhost:8000/catalog/chat"
    
    # Test cases
    test_cases = [
        "What are the different types of gold purity available?",
        "What is the difference between 22K and 18K gold?",
        "What is the current gold rate?",
        "How do I measure my ring size?",
        "What is BIS hallmark certification?",
        "Do you have diamond rings under ₹50000?",
        "How should I care for my gold jewelry?",
        "What is your return policy?",
        "Track order SJ-12345"
    ]
    
    headers = {"Content-Type": "application/json"}
    
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
    test_chatbot()