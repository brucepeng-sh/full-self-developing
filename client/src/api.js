let memoryToken = null;
let handshakePromise = null;

export const getToken = async (forceHandshake = false) => {
    if (!forceHandshake && memoryToken) return memoryToken;
    
    if (!forceHandshake) {
        const urlParams = new URLSearchParams(window.location.search);
        let token = urlParams.get('token');
        if (token) {
            localStorage.setItem('appToken', token);
            window.history.replaceState({}, '', window.location.pathname);
            memoryToken = token;
            return token;
        } 
        
        token = localStorage.getItem('appToken');
        if (token) {
            // We'll try using it. If it's stale, requests will fail and we could clear it,
            // but for now let's return it.
            memoryToken = token;
            return token;
        }
    }

    if (handshakePromise) return handshakePromise;

    // Auto-handshake for Vite Dev Server environment
    handshakePromise = (async () => {
        try {
            const res = await fetch('/api/token/handshake');
            const data = await res.json();
            if (data.token) {
                const token = data.token;
                localStorage.setItem('appToken', token);
                memoryToken = token;
                return token;
            }
        } catch (e) {
            console.error('Failed to handshake token:', e);
        } finally {
            handshakePromise = null;
        }
        return null;
    })();
    
    return handshakePromise;
};

export const apiFetch = async (endpoint, options = {}, isRetry = false) => {
    const token = await getToken();
    const url = new URL(endpoint, window.location.origin);
    if (token) {
        url.searchParams.append('token', token);
    }
    
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'x-app-token': token } : {}),
        ...(options.headers || {})
    };

    const res = await fetch(url.toString(), { ...options, headers });
    
    if (res.status === 403 && !isRetry) {
        // Token might be stale (server rebooted), clear it and retry once
        memoryToken = null;
        localStorage.removeItem('appToken');
        await getToken(true); // force fresh handshake
        return apiFetch(endpoint, options, true); // retry
    }
    
    if (!res.ok) {
        let errMsg = `API Error: ${res.statusText}`;
        try {
            const data = await res.json();
            if (data.message) {
                errMsg = data.message;
            } else if (data.error) {
                if (typeof data.error === 'string') {
                    errMsg = data.error;
                } else if (data.error.message) {
                    errMsg = data.error.message;
                }
            }
        } catch (e) {}
        throw new Error(errMsg);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : {};
};
