/**
 * FRED API Wrapper
 * Handles fetching and caching of Federal Reserve Economic Data
 */
const FredApi = {
    /**
     * Fetch series data from FRED
     * @param {string} seriesId - FRED series ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {boolean} useCache - Whether to use cached data
     * @returns {Promise<Array>} Array of {date, value} objects
     */
    async fetchSeries(seriesId, startDate, endDate, useCache = true) {
        const cacheKey = `${Config.CACHE_PREFIX}${seriesId}_${startDate}_${endDate}`;

        // Check cache first
        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
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

        try {
            const baseUrl = `${Config.FRED_BASE_URL}?${params}`;
            const url = Config.CORS_PROXY ? `${Config.CORS_PROXY}${encodeURIComponent(baseUrl)}` : baseUrl;
            console.log('Fetching:', seriesId);
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 400) {
                    throw new Error('Invalid API key or request');
                }
                throw new Error(`FRED API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('FRED response for', seriesId, ':', data);

            if (data.error_message) {
                throw new Error(data.error_message);
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

            return processed;
        } catch (error) {
            console.error(`Error fetching ${seriesId}:`, error);
            throw error;
        }
    },

    /**
     * Fetch multiple series in parallel
     * @param {Array<string>} seriesIds - Array of series IDs
     * @param {string} startDate
     * @param {string} endDate
     * @param {boolean} useCache
     * @returns {Promise<Object>} Object with seriesId as key and data array as value
     */
    async fetchMultipleSeries(seriesIds, startDate, endDate, useCache = true) {
        const results = {};
        const promises = seriesIds.map(async (seriesId) => {
            try {
                const data = await this.fetchSeries(seriesId, startDate, endDate, useCache);
                results[seriesId] = data;
            } catch (error) {
                console.error(`Failed to fetch ${seriesId}:`, error);
                results[seriesId] = [];
            }
        });

        await Promise.all(promises);
        return results;
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
            console.warn('Failed to cache data:', e);
        }
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
    }
};
