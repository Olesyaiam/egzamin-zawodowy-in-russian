chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'makeHttpRequest') {
        if (!/^https?:\/\//.test(request.url)) {
            sendResponse({ success: false, error: "Invalid URL" });
            return false;
        }

        fetch(request.url, {
            method: request.method || 'GET',
            headers: request.headers || {},
            body: request.method === 'POST' ? request.data : null
        })
        .then(response => response.json())
        .then(data => sendResponse({success: true, data: data}))
        .catch(error => sendResponse({success: false, error: error.message}));

        return true;
    }
});
