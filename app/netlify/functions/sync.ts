// File location: /netlify/functions/sync.ts

import type { Handler, HandlerEvent } from "@netlify/functions";

const handler: Handler = async (event: HandlerEvent) => {
  // 1. Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  // 2. Get the Google Apps Script URL and data from the request
  const body = JSON.parse(event.body || "{}");
  const { googleScriptUrl, data } = body;

  if (!googleScriptUrl || !data) {
    return {
      statusCode: 400,
      body: "Bad Request: Missing 'googleScriptUrl' or 'data' in request body.",
    };
  }

  try {
    // 3. Forward the request to Google Apps Script
    const response = await fetch(googleScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(data),
      redirect: "follow", // Important: follow Google's redirect
    });

    // 4. Check if the forwarded request was successful
    if (!response.ok) {
      throw new Error(`Google Apps Script returned an error: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();

    // 5. Return the successful response from Google back to the app
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(responseData),
    };

  } catch (error) {
    console.error("Netlify sync function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Server Error",
        message: error instanceof Error ? error.message : "An unknown error occurred.",
      }),
    };
  }
};

export { handler };
