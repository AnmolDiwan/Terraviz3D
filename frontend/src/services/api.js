export async function apiFetch(path, options = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('tv3d_token') : null;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const mergedOptions = {
        ...options,
        credentials: 'include',
        headers
    };

    const response = await fetch(path, mergedOptions);

    if (response.status === 401) {
        if (!options.silentAuthFail && typeof window !== 'undefined') {
            localStorage.removeItem('tv3d_token');
            window.dispatchEvent(new CustomEvent('auth:expired'));
        }
        throw new Error('Authentication expired');
    }

    if (!response.ok) {
        let errorMsg = 'An error occurred';
        try {
            const data = await response.json();
            errorMsg = data.error || errorMsg;
        } catch (e) {
            // response was not JSON
        }
        throw new Error(errorMsg);
    }

    return response.json();
}
