const axios = require('axios');

// Simulate the frontend logic for handling chat queries
async function testChatbotFunctionality() {
    // Test cases
    const testCases = [
        "What is the price of 1 gram gold?",
        "What is the gold rate today?",
        "What is BIS hallmark certification?",
        "How do I measure my ring size?",
        "What is the price of 1 gram of gold?",
        "How much is gold per gram?",
        "Gold price per gram today"
    ];

    // Simulate the FAQ detection function
    function faqAnswer(text) {
        // Skip FAQ for price/rate queries that should go to the gold rate function or AI
        if (/(gold\s*rate|gold\s*price|today'?s\s*gold|price.*gold|gold.*price|1\s*gram.*gold|gold.*1\s*gram|what.*price.*1\s*gram.*gold|what.*gold.*price)/i.test(text)) {
            return null;
        }
        
        if (/hallmark|bis/i.test(text)) return 'BIS hallmark certification ensures the purity of gold jewelry.';
        if (/(ring )?size|resiz(e|ing)/i.test(text)) return 'Most rings can be resized by 1–2 sizes. For accurate sizing, use our complimentary ring sizer tool or visit a store.';
        return null;
    }

    // Simulate gold rate query detection
    function isGoldRateQuery(lower) {
        return /(gold\s*rate|gold\s*price|today'?s\s*gold|price.*gold.*1\s*gram|1\s*gram.*gold.*price|price.*1\s*gram.*gold|1\s*gram.*price.*gold|what.*price.*1\s*gram.*gold|what.*gold.*price)/i.test(lower);
    }

    console.log("Testing chatbot functionality...\n");

    for (const message of testCases) {
        const lower = message.toLowerCase();
        const isGoldQuery = isGoldRateQuery(lower);
        const faqResponse = faqAnswer(message);

        console.log(`Message: "${message}"`);
        console.log(`Is gold rate query: ${isGoldQuery}`);
        console.log(`FAQ response: ${faqResponse ? `"${faqResponse}"` : 'null'}`);

        if (isGoldQuery) {
            console.log("Result: Should be handled by gold rate function\n");
        } else if (faqResponse) {
            console.log("Result: Should be handled by FAQ function\n");
        } else {
            console.log("Result: Should be sent to AI\n");
        }
    }
}

// Run the test
testChatbotFunctionality().catch(console.error);