/**
 * Chart.js Visualization Manager
 * Creates and updates all dashboard charts
 */
const Charts = {
    instances: {},
    costWeights: null,

    /**
     * Initialize charts module
     * @param {Object} costWeights - Cost weighting configuration
     */
    async init(costWeights) {
        this.costWeights = costWeights;

        // Set Chart.js defaults
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.borderColor = '#475569';
        Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    },

    /**
     * Create the main trend line chart
     * @param {Object} seriesData - Object with series data
     * @returns {Chart}
     */
    createTrendChart(seriesData) {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return null;

        // Destroy existing chart
        if (this.instances.trend) {
            this.instances.trend.destroy();
        }

        const datasets = [];
        const legend = document.getElementById('trendLegend');
        legend.innerHTML = '';

        // Create datasets for each series
        Object.entries(seriesData).forEach(([seriesId, data]) => {
            const meta = Config.SERIES_META[seriesId];
            if (!meta || !data || data.length === 0) return;

            // Normalize data to index
            const normalizedData = FredApi.normalizeToIndex(data);

            datasets.push({
                label: meta.name,
                data: normalizedData.map(d => ({ x: d.date, y: d.value })),
                borderColor: meta.color,
                backgroundColor: meta.color + '20',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.3,
                fill: false
            });

            // Add legend item
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.dataset.series = seriesId;
            legendItem.innerHTML = `
                <span class="legend-color" style="background-color: ${meta.color}"></span>
                <span>${meta.name}</span>
            `;
            legendItem.addEventListener('click', () => this.toggleSeries('trend', seriesId));
            legend.appendChild(legendItem);
        });

        this.instances.trend = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f8fafc',
                        bodyColor: '#94a3b8',
                        borderColor: '#475569',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            title: (items) => {
                                if (items.length > 0) {
                                    return new Date(items[0].parsed.x).toLocaleDateString();
                                }
                                return '';
                            },
                            label: (context) => {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month',
                            displayFormats: {
                                month: 'MMM yyyy'
                            }
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 12
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Index (Base = 100)'
                        },
                        grid: {
                            color: '#334155'
                        }
                    }
                }
            }
        });

        return this.instances.trend;
    },

    /**
     * Create cost breakdown donut chart
     * @param {string} productId - Product identifier
     * @param {Object} latestValues - Latest values for each factor
     * @returns {Chart}
     */
    createBreakdownChart(productId, latestValues) {
        const ctx = document.getElementById('breakdownChart');
        if (!ctx || !this.costWeights) return null;

        // Destroy existing chart
        if (this.instances.breakdown) {
            this.instances.breakdown.destroy();
        }

        const product = this.costWeights.products[productId];
        if (!product) return null;

        // Update subtitle
        const subtitle = document.getElementById('breakdownProduct');
        if (subtitle) {
            subtitle.textContent = product.name;
        }

        const labels = [];
        const data = [];
        const colors = [];

        Object.entries(product.weights).forEach(([factor, weight]) => {
            const factorConfig = this.costWeights.factors[factor];
            if (factorConfig) {
                labels.push(factorConfig.name);
                data.push((weight * 100).toFixed(1));
                colors.push(factorConfig.color);
            }
        });

        this.instances.breakdown = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors,
                    borderColor: '#1e293b',
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f8fafc',
                        bodyColor: '#94a3b8',
                        borderColor: '#475569',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                return `${context.label}: ${context.parsed}%`;
                            }
                        }
                    }
                }
            }
        });

        return this.instances.breakdown;
    },

    /**
     * Create year-over-year comparison bar chart
     * @param {Object} seriesData - Series data with YoY calculations
     * @returns {Chart}
     */
    createYoYChart(seriesData) {
        const ctx = document.getElementById('yoyChart');
        if (!ctx) return null;

        // Destroy existing chart
        if (this.instances.yoy) {
            this.instances.yoy.destroy();
        }

        const labels = [];
        const data = [];
        const colors = [];

        Object.entries(seriesData).forEach(([seriesId, seriesValues]) => {
            const meta = Config.SERIES_META[seriesId];
            if (!meta || !seriesValues || seriesValues.length === 0) return;

            const yoyChange = FredApi.calculateYoYChange(seriesValues);
            if (yoyChange !== null) {
                labels.push(meta.name);
                data.push(parseFloat(yoyChange));
                colors.push(parseFloat(yoyChange) >= 0 ? '#22c55e' : '#ef4444');
            }
        });

        this.instances.yoy = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'YoY Change (%)',
                    data,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f8fafc',
                        bodyColor: '#94a3b8',
                        borderColor: '#475569',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                const value = context.parsed.x;
                                const sign = value >= 0 ? '+' : '';
                                return `${sign}${value.toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#334155'
                        },
                        ticks: {
                            callback: (value) => `${value}%`
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

        return this.instances.yoy;
    },

    /**
     * Create product group cost comparison chart
     * @param {Object} seriesData - Series data
     * @returns {Chart}
     */
    createProductChart(seriesData) {
        const ctx = document.getElementById('productChart');
        if (!ctx || !this.costWeights) return null;

        // Destroy existing chart
        if (this.instances.product) {
            this.instances.product.destroy();
        }

        const products = this.costWeights.products;
        const labels = [];
        const data = [];
        const colors = [];

        // Calculate weighted cost index for each product
        Object.entries(products).forEach(([productId, product]) => {
            let weightedIndex = 0;
            let totalWeight = 0;

            Object.entries(product.weights).forEach(([factor, weight]) => {
                const factorConfig = this.costWeights.factors[factor];
                if (factorConfig && seriesData[factorConfig.seriesId]) {
                    const seriesValues = seriesData[factorConfig.seriesId];
                    if (seriesValues && seriesValues.length > 0) {
                        const normalized = FredApi.normalizeToIndex(seriesValues);
                        const latest = normalized[normalized.length - 1].value;
                        weightedIndex += latest * weight;
                        totalWeight += weight;
                    }
                }
            });

            if (totalWeight > 0) {
                labels.push(product.name);
                data.push((weightedIndex / totalWeight).toFixed(2));
                colors.push(product.color);
            }
        });

        this.instances.product = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Cost Index',
                    data,
                    backgroundColor: colors,
                    borderColor: colors.map(c => c),
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f8fafc',
                        bodyColor: '#94a3b8',
                        borderColor: '#475569',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                return `Cost Index: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: false,
                        min: 90,
                        title: {
                            display: true,
                            text: 'Weighted Cost Index'
                        },
                        grid: {
                            color: '#334155'
                        }
                    }
                }
            }
        });

        return this.instances.product;
    },

    /**
     * Toggle series visibility in a chart
     * @param {string} chartName - Chart instance name
     * @param {string} seriesId - Series ID to toggle
     */
    toggleSeries(chartName, seriesId) {
        const chart = this.instances[chartName];
        if (!chart) return;

        const meta = Config.SERIES_META[seriesId];
        if (!meta) return;

        // Find dataset index
        const datasetIndex = chart.data.datasets.findIndex(ds => ds.label === meta.name);
        if (datasetIndex === -1) return;

        // Toggle visibility
        const isHidden = chart.getDatasetMeta(datasetIndex).hidden;
        chart.getDatasetMeta(datasetIndex).hidden = !isHidden;

        // Update legend item
        const legendItem = document.querySelector(`.legend-item[data-series="${seriesId}"]`);
        if (legendItem) {
            legendItem.classList.toggle('disabled', !isHidden);
        }

        chart.update();
    },

    /**
     * Update all charts with new data
     * @param {Object} seriesData - All series data
     * @param {string} productId - Selected product ID
     */
    updateAll(seriesData, productId) {
        this.createTrendChart(seriesData);
        this.createBreakdownChart(productId, seriesData);
        this.createYoYChart(seriesData);
        this.createProductChart(seriesData);
    },

    /**
     * Destroy all chart instances
     */
    destroyAll() {
        Object.values(this.instances).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.instances = {};
    }
};
