/**
 * News & Sentiment Analysis Module
 * Fetches news and adjusts forecasts based on sentiment
 */
const News = {
    // Keywords that indicate price increases
    bullishKeywords: [
        'opec cut', 'production cut', 'supply shortage', 'sanctions', 'war',
        'conflict', 'refinery shutdown', 'hurricane', 'embargo', 'tariff',
        'demand surge', 'shortage', 'disruption', 'geopolitical tension',
        'price hike', 'inflation rise', 'supply chain crisis'
    ],

    // Keywords that indicate price decreases
    bearishKeywords: [
        'opec increase', 'production increase', 'oversupply', 'demand drop',
        'recession', 'economic slowdown', 'trade deal', 'sanctions lifted',
        'peace', 'ceasefire', 'surplus', 'glut', 'price drop', 'deflation',
        'weak demand', 'inventory build'
    ],

    currentSentiment: 0, // -1 to 1 scale

    /**
     * Fetch news from free RSS feeds via a proxy
     */
    async fetchNews() {
        const feeds = [
            { name: 'Oil & Energy', url: 'https://news.google.com/rss/search?q=oil+price+energy&hl=en-US&gl=US&ceid=US:en' },
            { name: 'Commodities', url: 'https://news.google.com/rss/search?q=crude+oil+commodities&hl=en-US&gl=US&ceid=US:en' }
        ];

        const newsItems = [];
        const corsProxy = 'https://corsproxy.io/?';

        for (const feed of feeds) {
            try {
                const response = await fetch(corsProxy + encodeURIComponent(feed.url));
                const text = await response.text();
                const parser = new DOMParser();
                const xml = parser.parseFromString(text, 'text/xml');
                const items = xml.querySelectorAll('item');

                items.forEach((item, index) => {
                    if (index < 5) { // Limit to 5 items per feed
                        const title = item.querySelector('title')?.textContent || '';
                        const pubDate = item.querySelector('pubDate')?.textContent || '';
                        const link = item.querySelector('link')?.textContent || '';

                        newsItems.push({
                            title,
                            date: new Date(pubDate),
                            link,
                            source: feed.name,
                            sentiment: this.analyzeSentiment(title)
                        });
                    }
                });
            } catch (error) {
                console.warn('Failed to fetch news from', feed.name, error);
            }
        }

        // Sort by date, newest first
        newsItems.sort((a, b) => b.date - a.date);

        // Calculate overall sentiment
        this.calculateOverallSentiment(newsItems);

        return newsItems.slice(0, 8); // Return top 8 items
    },

    /**
     * Analyze sentiment of a headline
     * @param {string} text - Headline text
     * @returns {string} 'positive', 'negative', or 'neutral'
     */
    analyzeSentiment(text) {
        const lowerText = text.toLowerCase();

        let bullishScore = 0;
        let bearishScore = 0;

        this.bullishKeywords.forEach(keyword => {
            if (lowerText.includes(keyword)) bullishScore++;
        });

        this.bearishKeywords.forEach(keyword => {
            if (lowerText.includes(keyword)) bearishScore++;
        });

        if (bullishScore > bearishScore) return 'positive';
        if (bearishScore > bullishScore) return 'negative';
        return 'neutral';
    },

    /**
     * Calculate overall market sentiment
     * @param {Array} newsItems - News items with sentiment
     */
    calculateOverallSentiment(newsItems) {
        let score = 0;
        newsItems.forEach(item => {
            if (item.sentiment === 'positive') score += 1;
            if (item.sentiment === 'negative') score -= 1;
        });

        // Normalize to -1 to 1
        this.currentSentiment = newsItems.length > 0 ? score / newsItems.length : 0;
    },

    /**
     * Get forecast adjustment based on sentiment
     * @returns {Object} {multiplier, description}
     */
    getForecastAdjustment() {
        const sentiment = this.currentSentiment;

        if (sentiment > 0.3) {
            return {
                multiplier: 1.05 + (sentiment * 0.1), // Up to 15% increase
                description: 'Bullish news sentiment - prices may rise faster than trend'
            };
        } else if (sentiment < -0.3) {
            return {
                multiplier: 0.95 + (sentiment * 0.1), // Up to 15% decrease
                description: 'Bearish news sentiment - prices may fall or rise slower'
            };
        } else {
            return {
                multiplier: 1,
                description: 'Neutral sentiment - forecast based on historical trend'
            };
        }
    },

    /**
     * Get sentiment label
     * @returns {string} 'Bullish', 'Bearish', or 'Neutral'
     */
    getSentimentLabel() {
        if (this.currentSentiment > 0.2) return 'Bullish';
        if (this.currentSentiment < -0.2) return 'Bearish';
        return 'Neutral';
    },

    /**
     * Render news items to the DOM
     * @param {Array} newsItems - News items to display
     */
    render(newsItems) {
        const container = document.getElementById('newsContent');
        const badge = document.getElementById('sentimentBadge');
        const adjustment = document.getElementById('forecastAdjustment');

        if (!container) return;

        if (newsItems.length === 0) {
            container.innerHTML = '<p class="news-loading">No recent news available</p>';
            return;
        }

        const html = newsItems.map(item => `
            <div class="news-item">
                <div class="news-sentiment ${item.sentiment}"></div>
                <div class="news-text">
                    <div class="news-title">${item.title}</div>
                    <div class="news-meta">${item.source} • ${this.formatDate(item.date)}</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;

        // Update sentiment badge
        if (badge) {
            const label = this.getSentimentLabel();
            badge.textContent = label;
            badge.className = 'sentiment-badge ' + label.toLowerCase();
        }

        // Update forecast adjustment text
        if (adjustment) {
            const adj = this.getForecastAdjustment();
            adjustment.textContent = adj.description;
        }
    },

    /**
     * Format date for display
     * @param {Date} date
     * @returns {string}
     */
    formatDate(date) {
        const now = new Date();
        const diff = now - date;
        const hours = Math.floor(diff / (1000 * 60 * 60));

        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }
};
