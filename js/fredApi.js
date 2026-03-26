/**
 * FRED API Wrapper
 * Handles fetching and caching of Federal Reserve Economic Data
 * Optimized for reliability with timeouts, retries, batching, and smart proxy selection
 */
const FredApi = {
    // Track which proxy is currently working
    workingProxyIndex: 0,

    // Track failed series for UI feedback
    failedSeries: new Set(),

    // Request timeout in milliseconds
    REQUEST_TIMEOUT: 15000,

    // Retry configuration
    MAX_RETRIES: 3,
    BASE_DELAY: 1000,

    // Batch size for parallel requests
    BATCH_SIZE: 4,

    /**
     * Fetch with timeout using AbortController
     * @param {string} url - URL to fetch
     * @param {number} timeout - Timeout in ms
     * @returns {Promise<Response>}
     */
    async fetchWithTimeout(url, timeout = this.REQUEST_TIMEOUT) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    },

    /**
     * Sleep utility for retry delays
     * @param {number} ms - Milliseconds to sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Try fetching from a specific proxy with retry logic
     * @param {string} baseUrl - The FRED API URL
     * @param {Object} proxy - Proxy configuration
     * @param {number} retries - Number of retries remaining
     * @returns {Promise<Object|null>}
     */
    async tryProxy(baseUrl, proxy, retries = this.MAX_RETRIES) {
        const proxyUrl = proxy.encode
            ? `${proxy.url}${encodeURIComponent(baseUrl)}`
            : `${proxy.url}${baseUrl}`;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await this.fetchWithTimeout(proxyUrl);

                if (response.ok) {
                    const data = await response.json();
                    return data;
                }

                // Don't retry on 4xx client errors (except 429 rate limit)
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    return null;
                }

            } catch (error) {
                // Log but continue to retry
                if (attempt < retries) {
                    const delay = this.BASE_DELAY * Math.pow(2, attempt);
                    await this.sleep(delay);
                }
            }
        }

        return null;
    },

    /**
     * Fetch series data from FRED with optimized proxy selection
     * @param {string} seriesId - FRED series ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {boolean} useCache - Whether to use cached data
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Array>} Array of {date, value} objects
     */
    async fetchSeries(seriesId, startDate, endDate, useCache = true, onProgress = null) {
        const cacheKey = `${Config.CACHE_PREFIX}${seriesId}_${startDate}_${endDate}`;

        // Check cache first
        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                if (onProgress) onProgress(seriesId, 'cached');
                return cached;
            }
        }

        const apiKey = Config.getApiKey();
        if (!apiKey) {
            throw new Error('FRED API key not configured');
        }

        const params = new URLSearchParams({
            series_id: seriesId,
            api_key: apiKey,
            file_type: 'json',
            observation_start: startDate,
            observation_end: endDate,
            sort_order: 'asc'
        });

        const baseUrl = `${Config.FRED_BASE_URL}?${params}`;
        let data = null;

        // Try working proxy first, then others
        const proxies = Config.CORS_PROXIES;
        const orderedProxies = [
            proxies[this.workingProxyIndex],
            ...proxies.slice(0, this.workingProxyIndex),
            ...proxies.slice(this.workingProxyIndex + 1)
        ].filter(Boolean);

        for (let i = 0; i < orderedProxies.length; i++) {
            const proxy = orderedProxies[i];
            if (onProgress) onProgress(seriesId, 'fetching', i + 1, orderedProxies.length);

            data = await this.tryProxy(baseUrl, proxy);

            if (data) {
                // Remember this proxy as working
                const originalIndex = proxies.indexOf(proxy);
                if (originalIndex !== -1) {
                    this.workingProxyIndex = originalIndex;
                }
                break;
            }
        }

        if (!data) {
            this.failedSeries.add(seriesId);
            if (onProgress) onProgress(seriesId, 'failed');
            console.error(`All proxies failed for ${seriesId}`);
            return [];
        }

        if (data.error_message) {
            this.failedSeries.add(seriesId);
            if (onProgress) onProgress(seriesId, 'error', data.error_message);
            console.error(`FRED API error for ${seriesId}:`, data.error_message);
            return [];
        }

        const observations = data.observations || [];
        const processed = observations
            .filter(obs => obs.value !== '.')
            .map(obs => ({
                date: obs.date,
                value: parseFloat(obs.value)
            }));

        // Cache the results
        this.saveToCache(cacheKey, processed);
        this.failedSeries.delete(seriesId);

        if (onProgress) onProgress(seriesId, 'success');

        return processed;
    },

    /**
     * Fetch multiple series with batching for better reliability
     * @param {Array<string>} seriesIds - Array of series IDs
     * @param {string} startDate
     * @param {string} endDate
     * @param {boolean} useCache
     * @param {Function} onProgress - Progress callback (completed, total, currentId)
     * @returns {Promise<Object>} Object with seriesId as key and data array as value
     */
    async fetchMultipleSeries(seriesIds, startDate, endDate, useCache = true, onProgress = null) {
        const results = {};
        this.failedSeries.clear();

        // Process in batches to avoid overwhelming proxies
        for (let i = 0; i < seriesIds.length; i += this.BATCH_SIZE) {
            const batch = seriesIds.slice(i, i + this.BATCH_SIZE);

            const batchPromises = batch.map(async (seriesId) => {
                try {
                    const data = await this.fetchSeries(
                        seriesId,
                        startDate,
                        endDate,
                        useCache,
                        (id, status) => {
                            if (onProgress) {
                                const completed = Object.keys(results).length;
                                onProgress(completed, seriesIds.length, id, status);
                            }
                        }
                    );
                    results[seriesId] = data;
                } catch (error) {
                    console.error(`Failed to fetch ${seriesId}:`, error);
                    results[seriesId] = [];
                    this.failedSeries.add(seriesId);
                }
            });

            await Promise.all(batchPromises);

            // Small delay between batches to prevent rate limiting
            if (i + this.BATCH_SIZE < seriesIds.length) {
                await this.sleep(200);
            }
        }

        return results;
    },

    /**
     * Get list of failed series for UI display
     * @returns {Array<string>}
     */
    getFailedSeries() {
        return Array.from(this.failedSeries);
    },

    /**
     * Get the latest value and change percentage for a series
     * @param {Array} data - Series data array
     * @returns {Object} {current, previous, change, changePercent}
     */
    getLatestWithChange(data) {
        if (!data || data.length < 2) {
            return { current: null, previous: null, change: null, changePercent: null };
        }

        const current = data[data.length - 1].value;
        const previous = data[data.length - 2].value;
        const change = current - previous;
        const changePercent = ((change / previous) * 100).toFixed(2);

        return {
            current: current.toFixed(2),
            previous: previous.toFixed(2),
            change: change.toFixed(2),
            changePercent
        };
    },

    /**
     * Calculate year-over-year change
     * @param {Array} data - Series data
     * @returns {number|null} YoY change percentage
     */
    calculateYoYChange(data) {
        if (!data || data.length === 0) return null;

        const current = data[data.length - 1];
        const currentDate = new Date(current.date);
        const yearAgoDate = new Date(currentDate);
        yearAgoDate.setFullYear(yearAgoDate.getFullYear() - 1);

        // Find closest data point to year ago
        const yearAgoData = data.find(d => {
            const dDate = new Date(d.date);
            const diff = Math.abs(dDate - yearAgoDate);
            return diff < 30 * 24 * 60 * 60 * 1000; // Within 30 days
        });

        if (!yearAgoData) return null;

        return (((current.value - yearAgoData.value) / yearAgoData.value) * 100).toFixed(2);
    },

    /**
     * Normalize data to index (base = 100)
     * @param {Array} data - Raw data array
     * @returns {Array} Normalized data
     */
    normalizeToIndex(data) {
        if (!data || data.length === 0) return [];

        const baseValue = data[0].value;
        return data.map(d => ({
            date: d.date,
            value: (d.value / baseValue) * 100
        }));
    },

    /**
     * Get from localStorage cache
     * @param {string} key
     * @returns {Array|null}
     */
    getFromCache(key) {
        try {
            const cached = localStorage.getItem(key);
            if (!cached) return null;

            const { data, timestamp } = JSON.parse(cached);
            const now = Date.now();

            if (now - timestamp > Config.CACHE_DURATION) {
                localStorage.removeItem(key);
                return null;
            }

            return data;
        } catch (e) {
            return null;
        }
    },

    /**
     * Save to localStorage cache
     * @param {string} key
     * @param {Array} data
     */
    saveToCache(key, data) {
        try {
            const cacheItem = {
                data,
                timestamp: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(cacheItem));
        } catch (e) {
            // If localStorage is full, clear old entries and retry
            if (e.name === 'QuotaExceededError') {
                this.clearOldCache();
                try {
                    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
                } catch (e2) {
                    console.warn('Failed to cache data after cleanup:', e2);
                }
            } else {
                console.warn('Failed to cache data:', e);
            }
        }
    },

    /**
     * Clear old cache entries (older than cache duration)
     */
    clearOldCache() {
        const keysToRemove = [];
        const now = Date.now();

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(Config.CACHE_PREFIX) && !key.includes('api_key')) {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    if (item && item.timestamp && (now - item.timestamp > Config.CACHE_DURATION)) {
                        keysToRemove.push(key);
                    }
                } catch (e) {
                    keysToRemove.push(key);
                }
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    },

    /**
     * Clear all cached data
     */
    clearCache() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(Config.CACHE_PREFIX) && !key.includes('api_key')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        this.workingProxyIndex = 0;
        this.failedSeries.clear();
    }
};
