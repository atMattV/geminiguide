// netlify/functions/gemini-proxy.js

// Ensure node-fetch is a dependency in your netlify/functions/package.json
// or your root package.json if Netlify is configured to look there.
// Example package.json content for netlify/functions:
// {
//   "dependencies": {
//     "node-fetch": "^2.6.1"
//   }
// }
// Then run `npm install` or `yarn install` in that directory and commit package.json and package-lock.json/yarn.lock.
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== "POST") {
        console.log("Method Not Allowed:", event.httpMethod);
        return {
            statusCode: 405,
            headers: { "Content-Type": "application/json", "Allow": "POST" },
            body: JSON.stringify({ error: "Method Not Allowed. Please use POST." })
        };
    }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (e) {
        console.error("Error parsing request body:", e, "Received body:", event.body);
        return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Bad request: Could not parse JSON body." })
        };
    }

    const { prompt } = requestBody;

    if (!prompt) {
        console.error("Missing prompt in request body. Body received:", event.body);
        return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Bad request: 'prompt' is missing in the request body." })
        };
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        console.error("CRITICAL: GEMINI_API_KEY environment variable is not set in Netlify.");
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Server configuration error: API key is missing." })
        };
    }

    const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
    const payload = { contents: chatHistory };
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    console.log("Attempting to call Gemini API with prompt:", prompt.substring(0, 100) + "..."); // Log a snippet

    try {
        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseBodyText = await geminiResponse.text(); // Get raw text first for better debugging
        let geminiData;

        try {
            geminiData = JSON.parse(responseBodyText); // Try to parse as JSON
        } catch (e) {
            console.error("Error parsing Gemini API response as JSON. Status:", geminiResponse.status, "Body:", responseBodyText);
            return {
                statusCode: 502, // Bad Gateway, as we couldn't understand upstream response
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Invalid response from upstream API. Could not parse JSON.", details: responseBodyText })
            };
        }
        
        console.log("Gemini API Response Status:", geminiResponse.status);
        // console.log("Gemini API Response Body:", JSON.stringify(geminiData, null, 2)); // Log the full response if needed for debugging

        if (!geminiResponse.ok) {
            const errorMessage = geminiData.error?.message || `Gemini API responded with status ${geminiResponse.status}`;
            console.error("Gemini API Error:", errorMessage, "Full error object:", geminiData.error);
            return {
                statusCode: geminiResponse.status, // Forward the status from Gemini if it's an error
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: `Gemini API Error: ${errorMessage}`, details: geminiData.error })
            };
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiData) // Forward the successful Gemini response
        };

    } catch (error) {
        console.error("Error during fetch to Gemini API or processing:", error);
        return {
            statusCode: 500, // Internal Server Error for the proxy function
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: `Proxy function execution error: ${error.message}` })
        };
    }
};
