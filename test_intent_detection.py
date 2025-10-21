# Test the intent detection logic
def test_intent_detection():
    # Test cases
    test_cases = [
        "What is the price of 1 gram gold?",
        "What is the gold rate today?",
        "gold rate",
        "gold rate today",
        "price of 1 gram gold",
        "How much is 1 gram of gold?"
    ]
    
    for user_message in test_cases:
        lower_message = user_message.lower()
        
        # Check gold rate intent
        is_gold_rate_query = (
            any(keyword in lower_message for keyword in ["gold rate", "gold price", "price of gold", "rate of gold"]) or
            ("gold" in lower_message and "1 gram" in lower_message and any(keyword in lower_message for keyword in ["price", "rate", "cost", "much"])) or
            ("price" in lower_message and "1 gram" in lower_message and "gold" in lower_message)
        )
        
        print(f"Message: '{user_message}'")
        print(f"Lower: '{lower_message}'")
        print(f"Is gold rate query: {is_gold_rate_query}")
        print("---")

if __name__ == "__main__":
    test_intent_detection()