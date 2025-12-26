export function postErrorResponseToPort(port: any, message = "Internal server error") {
  if (!port) return;
  try {
    port.postMessage({
      response: {
        status: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: message }),
      },
    });
  } catch (e) {
    console.error("swHelpers: failed to post error response to port", e);
  }
}
