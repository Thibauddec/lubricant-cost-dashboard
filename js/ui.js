/**
 * UI Components Manager
 */
const UI = {
    elements: {},

    init() {
        this.cacheElements();
        this.setupEventListeners();
    },

    cacheElements() {
        this.elements = {
            dateRangeBtns: document.querySelectorAll('.range-btn'),
            productSelect: document.getElementById('productSelect'),
            refreshBtn: document.getElementById('refreshData'),
            lastUpdated: document.getElementById('lastUpdated'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText')
        };
    },

    setupEventListeners() {
        // Date range buttons
        this.elements.dateRangeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const range = btn.dataset.range;
                this.elements.dateRangeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (window.App) App.setDateRange(range);
            });
        });

        // Product tabs
        document.querySelectorAll('.product-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.product-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const product = tab.dataset.product;
                if (this.elements.productSelect) {
                    this.elements.productSelect.value = product;
                }
                if (window.App) App.setProduct(product);
            });
        });

        // Refresh button
        this.elements.refreshBtn?.addEventListener('click', () => {
            if (window.App) App.refreshData();
        });

        // Scenario sliders
        this.setupScenarioControls();
    },

    setupScenarioControls() {
        const sliders = ['Crude', 'Additives', 'Transport', 'Labor'];

        sliders.forEach(name => {
            const slider = document.getElementById(`scenario${name}`);
            const valueDisplay = document.getElementById(`scenario${name}Value`);

            if (slider && valueDisplay) {
                slider.addEventListener('input', () => {
                    const val = slider.value;
                    valueDisplay.textContent = `${val > 0 ? '+' : ''}${val}%`;
                    valueDisplay.style.color = val > 0 ? '#ef4444' : val < 0 ? '#22c55e' : '#94a3b8';
                    this.updateScenarioResults();
                });
            }
        });

        // Reset button
        const resetBtn = document.getElementById('resetScenario');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                sliders.forEach(name => {
                    const slider = document.getElementById(`scenario${name}`);
                    const valueDisplay = document.getElementById(`scenario${name}Value`);
                    if (slider) slider.value = 0;
                    if (valueDisplay) {
                        valueDisplay.textContent = '0%';
                        valueDisplay.style.color = '#94a3b8';
                    }
                });
                this.updateScenarioResults();
            });
        }
    },

    updateScenarioResults() {
        const changes = {
            crude: parseInt(document.getElementById('scenarioCrude')?.value || 0),
            additives: parseInt(document.getElementById('scenarioAdditives')?.value || 0),
            transport: parseInt(document.getElementById('scenarioTransport')?.value || 0),
            labor: parseInt(document.getElementById('scenarioLabor')?.value || 0)
        };

        if (window.App && App.state.costWeights) {
            const impacts = Forecast.calculateScenarioImpact(changes, App.state.costWeights);

            Object.entries(impacts).forEach(([productId, impact]) => {
                const el = document.getElementById(`scenario${productId}`);
                if (el) {
                    const val = parseFloat(impact);
                    el.textContent = `${val > 0 ? '+' : ''}${impact}%`;
                    el.className = `result-value ${val > 0 ? 'positive' : val < 0 ? 'negative' : ''}`;
                }
            });
        }
    },

    showLoading(text = 'Loading data...') {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.remove('hidden');
        }
        if (this.elements.loadingText) {
            this.elements.loadingText.textContent = text;
        }
    },

    hideLoading() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.add('hidden');
        }
    },

    updateTimestamp() {
        if (this.elements.lastUpdated) {
            const now = new Date();
            this.elements.lastUpdated.textContent = `Updated: ${now.toLocaleString()}`;
        }
    },

    getSelectedProduct() {
        return this.elements.productSelect?.value || 'GI';
    },

    updateKpiCard(factor, current, changePercent) {
        const valueEl = document.getElementById(`${factor}-value`);
        const changeEl = document.getElementById(`${factor}-change`);

        if (valueEl && current !== null) {
            valueEl.textContent = current;
        }

        if (changeEl && changePercent !== null) {
            const change = parseFloat(changePercent);
            const sign = change >= 0 ? '+' : '';
            changeEl.textContent = `${sign}${change.toFixed(2)}%`;
            changeEl.className = `kpi-change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    },

    updateAllKpis(seriesData) {
        Object.entries(seriesData).forEach(([seriesId, data]) => {
            const meta = Config.SERIES_META[seriesId];
            if (meta && data && data.length >= 2) {
                const current = data[data.length - 1].value;
                const previous = data[0].value;
                const changePercent = ((current - previous) / previous) * 100;
                this.updateKpiCard(meta.factor, current.toFixed(2), changePercent);
                this.createSparkline(meta.factor, data, meta.color);
            }
        });
    },

    sparklineInstances: {},

    createSparkline(factor, data, color) {
        const canvas = document.getElementById(`${factor}-spark`);
        if (!canvas || !data || data.length < 2) return;

        // Destroy existing chart
        if (this.sparklineInstances[factor]) {
            this.sparklineInstances[factor].destroy();
        }

        // Sample data to last 20 points for sparkline
        const sampled = data.slice(-20);
        const values = sampled.map(d => d.value);

        this.sparklineInstances[factor] = new Chart(canvas, {
            type: 'line',
            data: {
                labels: sampled.map((_, i) => i),
                datasets: [{
                    data: values,
                    borderColor: color || '#3498db',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.3,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: { display: false },
                    y: { display: false }
                },
                animation: false
            }
        });
    }
};
