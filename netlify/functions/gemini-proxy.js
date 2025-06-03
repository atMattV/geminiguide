// netlify/functions/gemini-proxy.js
// We need to import a fetch-like library for Node.js environment in Netlify functions.
// Make sure to add "node-fetch" to your project's dependencies if it's not already.
// You can do this by creating a package.json in your root or netlify/functions folder
// and running `npm install node-fetch` or `yarn add node-fetch`.
// However, for simple cases, Netlify's environment might provide a global fetch.
// If not, you'll need to handle dependencies. For now, let's assume global fetch
// or you'll use a build step that includes it. A common way is to use 'node-fetch'.

// To use node-fetch, you'd typically do:
// const fetch = require('node-fetch');
// For this example, I'll assume a modern Netlify environment that might polyfill fetch,
// or you'll adjust based on your project's specific build setup.
// If 'fetch' is not defined, you'll need to install 'node-fetch' (e.g., version 2.x.x for CommonJS `require`)
// and include it: const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: "Method Not Allowed" })
        };
    }

    // 1. Get the prompt from the client-side request
    let promptText;
    try {
        const body = JSON.parse(event.body);
        promptText = body.prompt;
    } catch (e) {
        console.error("Error parsing request body:", e);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Bad request: Could not parse JSON body." })
        };
    }

    // 2. Get your API key from Netlify's environment variables
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY not configured in Netlify environment variables.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API key not configured on the server." })
        };
    }

    if (!promptText) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "No prompt provided in the request body." })
        };
    }

    // 3. Prepare the payload for the Gemini API
    const chatHistory = [{ role: "user", parts: [{ text: promptText }] }];
    const payload = { contents: chatHistory };
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    try {
        // 4. Make the call to the Gemini API
        // Ensure you have a fetch implementation available.
        // If using an older Node version on Netlify or if fetch isn't global,
        // you might need to explicitly use 'node-fetch'.
        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const geminiData = await geminiResponse.json(); // Try to parse JSON regardless of ok status to get error details

        if (!geminiResponse.ok) {
            console.error("Gemini API Error Response:", geminiData);
            const errorMessage = geminiData.error?.message || 'Unknown Gemini API error';
            return {
                statusCode: geminiResponse.status,
                body: JSON.stringify({ error: `Gemini API Error: ${errorMessage}` })
            };
        }

        // 5. Return the Gemini API's response to the client
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiData) // Send back the full Gemini response
        };

    } catch (error) {
        console.error("Error in Netlify function execution:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Function Execution Error: ${error.message}` })
        };
    }
};
