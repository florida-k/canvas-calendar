
const API_BASE = "http://localhost:8080/api/assignments";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message?.type;

  // Handle both saving and loading metadata
  if (
    type !== "MYCAL_SAVE_METADATA" &&
    type !== "MYCAL_GET_METADATA"
  ) {
    return false;
  }

  const { courseId, assignmentId } = message;

  // Validate Canvas identifiers
  if (
    !/^\d+$/.test(String(courseId)) ||
    !/^\d+$/.test(String(assignmentId))
  ) {
    sendResponse({
      ok: false,
      error: "Invalid Canvas assignment identifiers"
    });
    return false;
  }

  const url = `${API_BASE}/${courseId}/${assignmentId}`;

  async function handleRequest() {
    try {
      let response;

      if (type === "MYCAL_SAVE_METADATA") {
        response = await fetch(url, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(message.metadata)
        });
      } else {
        response = await fetch(url, {
          method: "GET"
        });

        // Assignment has never been saved
        if (response.status === 404) {
          sendResponse({
            ok: true,
            data: null
          });
          return;
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      sendResponse({
        ok: true,
        data
      });

    } catch (error) {
      sendResponse({
        ok: false,
        error: error.message
      });
    }
  }

  handleRequest();

  // Keep the message channel open for async response
  return true;
});
