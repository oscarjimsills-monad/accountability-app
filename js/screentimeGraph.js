/**
 * Screentime History Graph
 * Canvas-based chart with zoom levels and G(x) exponential bilateral trend line
 *
 * G(x) = (1/3) * [ sum_{i=1}^{inf} f(x-i)/2^i  +  f(x)  +  sum_{i=1}^{inf} f(x+i)/2^i ]
 * where f(z) = screentime on day z, or global mean if day z has no data.
 *
 * The infinite sums converge (geometric series), so we truncate at ~20 terms
 * (error < 1 minute at that depth for any realistic dataset).
 */

const ScreentimeGraph = {
    canvas: null,
    ctx: null,
    container: null,
    currentZoom: '1W',
    tooltip: null,
    animFrame: null,

    ZOOM_OPTIONS: [
        { label: '1W',  days: 7   },
        { label: '1M',  days: 30  },
        { label: '3M',  days: 90  },
        { label: '1Y',  days: 365 },
        { label: '5Y',  days: 1825},
    ],

    COLORS: {
        bar:        'rgba(99, 179, 237, 0.55)',
        barHover:   'rgba(99, 179, 237, 0.85)',
        barStroke:  'rgba(66, 153, 225, 0.9)',
        trend:      '#f6ad55',
        trendGlow:  'rgba(246, 173, 85, 0.25)',
        grid:       'rgba(160, 174, 192, 0.18)',
        axis:       'rgba(160, 174, 192, 0.55)',
        label:      '#a0aec0',
        labelDark:  '#e2e8f0',
        bg:         '#1a202c',
        tooltip: {
            bg:     '#2d3748',
            border: '#4a5568',
            text:   '#e2e8f0',
            accent: '#f6ad55',
        }
    },

    PAD: { top: 30, right: 24, bottom: 52, left: 58 },
    GOAL_MINUTES: 90,    // 1h 30m — green line + colour threshold
    WARN_MINUTES: 120,   // 2h — red threshold
    
    /**
     * Mount the graph into a given container element.
     * Call this once when the screentime page is rendered.
     */
    mount(containerSelector) {
        this.container = document.querySelector(containerSelector);
        if (!this.container) {
            console.error('ScreentimeGraph: container not found:', containerSelector);
            return;
        }
        this._buildDOM();
        this._attachEvents();
        this.render();
    },

    /**
     * Build the DOM structure inside the container
     */
    _buildDOM() {
        this.container.innerHTML = `
            <div class="stg-wrapper">
                <div class="stg-header">
                    <span class="stg-title">Screentime History</span>
                    <div class="stg-zoom-btns">
                        ${this.ZOOM_OPTIONS.map(z =>
                            `<button class="stg-zoom ${z.label === this.currentZoom ? 'active' : ''}"
                                     data-zoom="${z.label}">${z.label}</button>`
                        ).join('')}
                    </div>
                </div>
                <div class="stg-legend">
                    <span class="stg-legend-item bar">Daily screentime</span>
                    <span class="stg-legend-item trend">G(x) trend</span>
                </div>
                <div class="stg-canvas-wrap">
                    <canvas class="stg-canvas"></canvas>
                    <div class="stg-tooltip" style="display:none;"></div>
                </div>
            </div>
        `;

        this._injectStyles();

        this.canvas  = this.container.querySelector('.stg-canvas');
        this.ctx     = this.canvas.getContext('2d');
        this.tooltip = this.container.querySelector('.stg-tooltip');
    },

    _injectStyles() {
        if (document.getElementById('stg-styles')) return;
        const style = document.createElement('style');
        style.id = 'stg-styles';
        style.textContent = `
            .stg-wrapper {
                background: #1a202c;
                border-radius: 16px;
                padding: 20px 20px 16px;
                font-family: 'JetBrains Mono', 'Fira Mono', monospace;
                box-shadow: 0 4px 32px rgba(0,0,0,0.35);
                position: relative;
                user-select: none;
            }
            .stg-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 10px;
            }
            .stg-title {
                font-size: 14px;
                font-weight: 600;
                color: #e2e8f0;
                letter-spacing: 0.5px;
                text-transform: uppercase;
            }
            .stg-zoom-btns {
                display: flex;
                gap: 4px;
            }
            .stg-zoom {
                background: none;
                border: 1px solid #4a5568;
                color: #a0aec0;
                border-radius: 6px;
                padding: 3px 9px;
                font-size: 11px;
                font-family: inherit;
                cursor: pointer;
                transition: all 0.15s;
            }
            .stg-zoom:hover { border-color: #f6ad55; color: #f6ad55; }
            .stg-zoom.active { background: #f6ad55; border-color: #f6ad55; color: #1a202c; font-weight: 700; }
            .stg-legend {
                display: flex;
                gap: 20px;
                margin-bottom: 8px;
            }
            .stg-legend-item {
                font-size: 11px;
                color: #a0aec0;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .stg-legend-item::before {
                content: '';
                display: inline-block;
                width: 14px;
                height: 3px;
                border-radius: 2px;
            }
            .stg-legend-item.bar::before  { background: rgba(99,179,237,0.8); height: 10px; border-radius: 3px; }
            .stg-legend-item.trend::before { background: #f6ad55; }
            .stg-canvas-wrap {
                position: relative;
                width: 100%;
            }
            .stg-canvas {
                width: 100%;
                display: block;
                cursor: crosshair;
            }
            .stg-tooltip {
                position: absolute;
                background: #2d3748;
                border: 1px solid #4a5568;
                border-radius: 8px;
                padding: 8px 12px;
                font-family: 'JetBrains Mono', monospace;
                font-size: 12px;
                color: #e2e8f0;
                pointer-events: none;
                white-space: nowrap;
                z-index: 10;
                line-height: 1.7;
                box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            }
            .stg-tooltip .tt-date   { color: #a0aec0; font-size: 10px; }
            .stg-tooltip .tt-actual { color: #63b3ed; font-weight: 600; }
            .stg-tooltip .tt-trend  { color: #f6ad55; }
            .stg-tooltip .tt-none   { color: #718096; font-style: italic; }
        `;
        document.head.appendChild(style);
    },

    _attachEvents() {
        // Zoom buttons
        this.container.querySelectorAll('.stg-zoom').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentZoom = btn.dataset.zoom;
                this.container.querySelectorAll('.stg-zoom').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.render();
            });
        });

        // Tooltip on mouse move
        this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => {
            if (this.tooltip) this.tooltip.style.display = 'none';
        });

        // Resize
        window.addEventListener('resize', Utils.debounce(() => this.render(), 120));
    },

    // ─────────────────────────────────────────────────────────────
    //  DATA
    // ─────────────────────────────────────────────────────────────

    /**
     * Build the full date range for the current zoom window,
     * return array of { date, minutes, hasDatum } objects.
     */
    _buildRange() {
        const zoomDays = this.ZOOM_OPTIONS.find(z => z.label === this.currentZoom)?.days || 7;
        const entries  = ScreentimeTracker.entries || [];

        // Find dataset bounds
        const allDates = entries.map(e => e.date).sort();
        const dataStart = allDates[0];
        const dataEnd   = allDates[allDates.length - 1] || Utils.getTodayString();

        // Window: last N days up to today
        const today = new Date();
        const startD = new Date(today);
        startD.setDate(today.getDate() - (zoomDays - 1));

        // Build day-indexed map
        const byDate = {};
        entries.forEach(e => { byDate[e.date] = e.totalMinutes; });

        const range = [];
        for (let d = new Date(startD); d <= today; d.setDate(d.getDate() + 1)) {
            const dateStr = Utils.getDateString(new Date(d));
            range.push({
                date:     dateStr,
                minutes:  byDate[dateStr] ?? null,
                hasDatum: dateStr in byDate,
            });
        }
        return range;
    },

    /**
     * Compute global mean of all recorded screentime values.
     * Used as f(z) for days with no data.
     */
    _globalMean() {
        const entries = ScreentimeTracker.entries || [];
        if (entries.length === 0) return 0;
        return entries.reduce((s, e) => s + e.totalMinutes, 0) / entries.length;
    },

    /**
     * Compute G(x) for every day in the range.
     *
     * G(x) = (1/3) * [
     *     sum_{i=1}^{inf} f(x-i)/2^i
     *   + f(x)
     *   + sum_{i=1}^{inf} f(x+i)/2^i
     * ]
     *
     * We truncate at TERMS = 20 (contributes < 1e-6 of any realistic value).
     * f(z) = byDate[z] if z exists, else globalMean.
     */
    _computeTrend(range) {
        const TERMS = 20;
        const byDate = {};
        (ScreentimeTracker.entries || []).forEach(e => { byDate[e.date] = e.totalMinutes; });
        const mean = this._globalMean();

        // f(z) as a function of date string
        const f = dateStr => (dateStr in byDate) ? byDate[dateStr] : mean;

        return range.map(({ date }) => {
            const x   = new Date(date);
            let total = f(date);  // f(x) term

            for (let i = 1; i <= TERMS; i++) {
                const weight = Math.pow(2, -i);

                const past = new Date(x);
                past.setDate(x.getDate() - i);
                total += f(Utils.getDateString(past)) * weight;

                const future = new Date(x);
                future.setDate(x.getDate() + i);
                total += f(Utils.getDateString(future)) * weight;
            }

            return total / 3;
        });
    },

    // ─────────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────────

    render() {
        if (!this.canvas) return;

        // Device pixel ratio (DPR) scaling for crisp rendering on retina screens
        const dpr  = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const W    = rect.width;
        const H    = Math.max(220, Math.min(320, W * 0.38));

        this.canvas.width  = W * dpr;
        this.canvas.height = H * dpr;
        this.canvas.style.width  = W + 'px';
        this.canvas.style.height = H + 'px';

        const ctx = this.ctx;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        const range  = this._buildRange();
        const trend  = this._computeTrend(range);
        const C      = this.COLORS;
        const PAD    = this.PAD;

        const chartW = W - PAD.left - PAD.right;
        const chartH = H - PAD.top  - PAD.bottom;

        // Max Y: max of actual data and trend, with 10% headroom
        const allVals = [
            ...range.filter(r => r.hasDatum).map(r => r.minutes),
            ...trend
        ];
        const maxVal = allVals.length ? Math.max(...allVals) * 1.12 : 600;

        // Store render state for tooltip hit-testing
        this._renderState = { range, trend, W, H, chartW, chartH, maxVal };

        // ── Grid lines
        const gridCount = 4;
        ctx.strokeStyle = C.grid;
        ctx.lineWidth   = 1;
        ctx.setLineDash([4, 4]);
        for (let i = 0; i <= gridCount; i++) {
            const y = PAD.top + chartH - (i / gridCount) * chartH;
            ctx.beginPath();
            ctx.moveTo(PAD.left, y);
            ctx.lineTo(PAD.left + chartW, y);
            ctx.stroke();

            // Y-axis labels
            const mins  = (i / gridCount) * maxVal;
            const label = this._fmtMinutes(mins);
            ctx.setLineDash([]);
            ctx.fillStyle  = C.label;
            ctx.font       = '10px JetBrains Mono, monospace';
            ctx.textAlign  = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, PAD.left - 6, y);
            ctx.setLineDash([4, 4]);
        }
        ctx.setLineDash([]);

        // ── X-axis
        ctx.strokeStyle = C.axis;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(PAD.left, PAD.top + chartH);
        ctx.lineTo(PAD.left + chartW, PAD.top + chartH);
        ctx.stroke();

        // ── X labels (adaptive density)
        const n = range.length;
        const labelStep = this._labelStep(n);
        ctx.fillStyle    = C.label;
        ctx.font         = '10px JetBrains Mono, monospace';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';

        range.forEach((r, i) => {
            if (i % labelStep === 0 || i === n - 1) {
                const x = PAD.left + (i / Math.max(n - 1, 1)) * chartW;
                ctx.fillText(this._fmtDateLabel(r.date, n), x, PAD.top + chartH + 8);
            }
        });

        // ── Bars
        const barW = Math.max(1.5, (chartW / n) * 0.65);

        range.forEach((r, i) => {
            if (!r.hasDatum) return;
            const x     = PAD.left + (i / Math.max(n - 1, 1)) * chartW;
            const barH  = (r.minutes / maxVal) * chartH;
            const y     = PAD.top + chartH - barH;

            let fill, stroke;
            if (r.minutes > this.WARN_MINUTES) {
                fill   = 'rgba(252, 129, 129, 0.6)';
                stroke = 'rgba(239, 68, 68, 0.9)';
            } else if (r.minutes < this.GOAL_MINUTES) {
                fill   = 'rgba(52, 211, 153, 0.6)';
                stroke = 'rgba(16, 185, 129, 0.9)';
            } else {
                fill   = 'rgba(99, 179, 237, 0.55)';
                stroke = 'rgba(66, 153, 225, 0.9)';
            }

            ctx.fillStyle = fill;
            ctx.beginPath();
            ctx.roundRect(x - barW / 2, y, barW, barH, [3, 3, 0, 0]);
            ctx.fill();

            ctx.strokeStyle = stroke;
            ctx.lineWidth   = 0.8;
            ctx.stroke();
        });

        // ── Goal line at 1h 30m
        const goalY = PAD.top + chartH - (this.GOAL_MINUTES / maxVal) * chartH;
        ctx.save();
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.85)';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(PAD.left, goalY);
        ctx.lineTo(PAD.left + chartW, goalY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle    = 'rgba(52, 211, 153, 0.9)';
        ctx.font         = '10px JetBrains Mono, monospace';
        ctx.textAlign    = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('1h 30m', PAD.left - 6, goalY);
        ctx.restore();

        // ── Trend line (G(x)) with glow
        this._drawTrendLine(ctx, range, trend, chartW, chartH, maxVal, PAD, C);
    },

    
    _drawTrendLine(ctx, range, trend, chartW, chartH, maxVal, PAD, C) {
        const n = range.length;
        if (n < 2) return;

        const xOf = i => PAD.left + (i / Math.max(n - 1, 1)) * chartW;
        const yOf = v => PAD.top  + chartH - (v / maxVal) * chartH;

        // Glow pass (wide semi-transparent line)
        ctx.save();
        ctx.strokeStyle = C.trendGlow;
        ctx.lineWidth   = 8;
        ctx.lineJoin    = 'round';
        ctx.lineCap     = 'round';
        ctx.beginPath();
        trend.forEach((v, i) => {
            i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v));
        });
        ctx.stroke();
        ctx.restore();

        // Main trend line
        ctx.save();
        ctx.strokeStyle = C.trend;
        ctx.lineWidth   = 2.2;
        ctx.lineJoin    = 'round';
        ctx.lineCap     = 'round';
        ctx.beginPath();
        trend.forEach((v, i) => {
            i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v));
        });
        ctx.stroke();
        ctx.restore();
    },

    // ─────────────────────────────────────────────────────────────
    //  TOOLTIP
    // ─────────────────────────────────────────────────────────────

    _onMouseMove(e) {
        if (!this._renderState) return;
        const { range, trend, W, H, chartW, chartH, maxVal } = this._renderState;
        const PAD = this.PAD;

        const rect  = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Map mouseX to nearest data index
        const n   = range.length;
        const frac = (mouseX - PAD.left) / chartW;
        const idx  = Math.round(frac * (n - 1));

        if (idx < 0 || idx >= n) {
            this.tooltip.style.display = 'none';
            return;
        }

        const r    = range[idx];
        const tVal = trend[idx];

        let html = `<div class="tt-date">${this._fmtDateFull(r.date)}</div>`;
        if (r.hasDatum) {
            html += `<div class="tt-actual">📱 ${this._fmtMinutes(r.minutes)}</div>`;
        } else {
            html += `<div class="tt-none">no data</div>`;
        }
        html += `<div class="tt-trend">⟿ G(x): ${this._fmtMinutes(tVal)}</div>`;

        this.tooltip.innerHTML = html;
        this.tooltip.style.display = 'block';

        // Position tooltip (flip if near right edge)
        const tipW = this.tooltip.offsetWidth  + 16;
        const tipH = this.tooltip.offsetHeight + 8;
        let tipX   = mouseX + 14;
        let tipY   = mouseY - tipH / 2;

        if (tipX + tipW > W)  tipX = mouseX - tipW;
        if (tipY < 0)          tipY = 4;
        if (tipY + tipH > H)   tipY = H - tipH - 4;

        this.tooltip.style.left = tipX + 'px';
        this.tooltip.style.top  = tipY + 'px';
    },

    // ─────────────────────────────────────────────────────────────
    //  FORMAT HELPERS
    // ─────────────────────────────────────────────────────────────

    _fmtMinutes(mins) {
        mins = Math.round(mins);
        if (mins < 60) return `${mins}m`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m === 0 ? `${h}h` : `${h}h ${m}m`;
    },

    _fmtDateLabel(dateStr, totalDays) {
        const d = new Date(dateStr);
        if (totalDays <= 14)  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        if (totalDays <= 90)  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        if (totalDays <= 365) return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    },

    _fmtDateFull(dateStr) {
        return new Date(dateStr).toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });
    },

    _labelStep(n) {
        if (n <= 10)  return 1;
        if (n <= 20)  return 2;
        if (n <= 45)  return 5;
        if (n <= 95)  return 10;
        if (n <= 200) return 20;
        return Math.ceil(n / 10);
    },
};

// Make ScreentimeGraph available globally
window.ScreentimeGraph = ScreentimeGraph;

// Made with Bob