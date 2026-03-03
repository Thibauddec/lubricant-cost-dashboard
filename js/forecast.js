/**
 * Advanced Forecasting Module
 * Implements ARIMA-style forecasting with seasonal adjustments
 */
const Forecast = {
    /**
     * Detect seasonality in data (monthly patterns)
     * @param {Array} data - Time series data [{date, value}]
     * @returns {Object} Seasonal indices by month
     */
    detectSeasonality(data) {
        if (!data || data.length < 24) return null;

        const monthlyAvg = {};
        const monthCounts = {};

        data.forEach(point => {
            const month = new Date(point.date).getMonth();
            if (!monthlyAvg[month]) {
                monthlyAvg[month] = 0;
                monthCounts[month] = 0;
            }
            monthlyAvg[month] += point.value;
            monthCounts[month]++;
        });

        let overallAvg = 0;
        let totalCount = 0;
        Object.keys(monthlyAvg).forEach(month => {
            monthlyAvg[month] /= monthCounts[month];
            overallAvg += monthlyAvg[month];
            totalCount++;
        });
        overallAvg /= totalCount;

        const seasonalIndices = {};
        Object.keys(monthlyAvg).forEach(month => {
            seasonalIndices[month] = monthlyAvg[month] / overallAvg;
        });

        return seasonalIndices;
    },

    /**
     * Simple moving average forecast - more stable than ARIMA
     * @param {Array} data - Historical data [{date, value}]
     * @param {number} periods - Forecast periods
     * @param {number} sentimentMultiplier - News sentiment adjustment
     * @returns {Object} {forecast, confidenceUpper, confidenceLower}
     */
    arimaForecast(data, periods = 6, sentimentMultiplier = 1) {
        if (!data || data.length < 6) {
            return { forecast: [], confidenceUpper: [], confidenceLower: [] };
        }

        const values = data.map(d => d.value);
        const n = values.length;

        // Use last 12 months for trend calculation (more stable)
        const recentData = values.slice(-12);
        const recentN = recentData.length;

        // Calculate recent trend (last 12 months only)
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        recentData.forEach((y, i) => {
            sumX += i;
            sumY += y;
            sumXY += i * y;
            sumX2 += i * i;
        });

        const slope = (recentN * sumXY - sumX * sumY) / (recentN * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / recentN;

        // Calculate monthly change rate (more intuitive)
        const lastValue = values[n - 1];
        const monthlyChangeRate = slope / lastValue; // As percentage of current value

        // Cap the monthly change rate to reasonable bounds (-3% to +3% per month)
        const cappedChangeRate = Math.max(-0.03, Math.min(0.03, monthlyChangeRate));

        // Calculate standard deviation for confidence intervals
        let sumSquaredErrors = 0;
        recentData.forEach((y, i) => {
            const predicted = intercept + slope * i;
            sumSquaredErrors += Math.pow(y - predicted, 2);
        });
        const stdDev = Math.sqrt(sumSquaredErrors / Math.max(1, recentN - 2));

        // Detect seasonality
        const seasonalIndices = this.detectSeasonality(data);

        // Generate forecast
        const lastDate = new Date(data[n - 1].date);
        const forecast = [];
        const confidenceUpper = [];
        const confidenceLower = [];

        // Start from last actual point
        forecast.push({
            x: data[n - 1].date,
            y: lastValue.toFixed(2)
        });

        let currentValue = lastValue;

        for (let i = 1; i <= periods; i++) {
            const futureDate = new Date(lastDate);
            futureDate.setMonth(futureDate.getMonth() + i);
            const dateStr = futureDate.toISOString().split('T')[0];
            const futureMonth = futureDate.getMonth();

            // Apply monthly change rate
            let predicted = currentValue * (1 + cappedChangeRate);

            // Apply seasonal adjustment if available
            if (seasonalIndices && seasonalIndices[futureMonth]) {
                const avgSeasonalIndex = Object.values(seasonalIndices).reduce((a, b) => a + b, 0) / 12;
                const seasonalEffect = (seasonalIndices[futureMonth] / avgSeasonalIndex - 1) * 0.5; // Dampened
                predicted *= (1 + seasonalEffect);
            }

            // Apply sentiment (very conservative - max 2% total adjustment)
            const sentimentAdjustment = (sentimentMultiplier - 1) * 0.3;
            predicted *= (1 + sentimentAdjustment);

            // Confidence intervals (widen over time)
            const confidenceWidth = stdDev * 1.5 * Math.sqrt(i);

            forecast.push({ x: dateStr, y: predicted.toFixed(2) });
            confidenceUpper.push({ x: dateStr, y: (predicted + confidenceWidth).toFixed(2) });
            confidenceLower.push({ x: dateStr, y: Math.max(0, predicted - confidenceWidth).toFixed(2) });

            currentValue = predicted;
        }

        return {
            forecast,
            confidenceUpper,
            confidenceLower,
            seasonalIndices,
            trend: cappedChangeRate > 0.005 ? 'upward' : cappedChangeRate < -0.005 ? 'downward' : 'stable',
            monthlyChangeRate: (cappedChangeRate * 100).toFixed(2) + '%'
        };
    },

    /**
     * Generate scenario impact calculation
     * @param {Object} changes - {crude: %, additives: %, transport: %, labor: %}
     * @param {Object} costWeights - Product cost weightings
     * @returns {Object} Impact by product
     */
    calculateScenarioImpact(changes, costWeights) {
        const impacts = {};

        Object.entries(costWeights.products).forEach(([productId, product]) => {
            let totalImpact = 0;

            const factorMapping = {
                crude: ['crude', 'baseOil'],
                additives: ['additives'],
                transport: ['transport'],
                labor: ['labor']
            };

            Object.entries(changes).forEach(([changeType, changePercent]) => {
                const factors = factorMapping[changeType] || [];
                factors.forEach(factor => {
                    const weight = product.weights[factor] || 0;
                    totalImpact += (changePercent / 100) * weight;
                });
            });

            impacts[productId] = (totalImpact * 100).toFixed(2);
        });

        return impacts;
    }
};
