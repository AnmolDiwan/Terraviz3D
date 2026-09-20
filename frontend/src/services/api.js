export async function apiFetch(path, options = {}) {
    const mergedOptions = {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };

    const response = await fetch(path, mergedOptions);

    if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('auth:expired'));
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
