import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    Filler,
    Decimation
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { FiZoomIn, FiZoomOut, FiArrowLeft, FiArrowRight, FiRefreshCcw } from 'react-icons/fi';
import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    Filler,
    zoomPlugin,
    Decimation
);

// Global plugin for comparison highlighting
const comparisonHighlightPlugin = {
    id: 'comparisonHighlight',
    beforeDatasetsDraw(chart, args, options) {
        const { range } = options;
        if (!range || !range.start || !range.end) return;

        const { ctx, chartArea: { top, bottom, left, width }, scales: { x } } = chart;
        const startTs = new Date(range.start).getTime();
        const endTs = new Date(range.end).getTime();

        const startX = x.getPixelForValue(startTs);
        const endX = x.getPixelForValue(endTs);

        if (isNaN(startX) || isNaN(endX)) return;

        ctx.save();

        // 1. Draw shaded area
        ctx.fillStyle = 'rgba(0, 255, 204, 0.12)'; // Slightly more visible
        const rectLeft = Math.max(left, Math.min(startX, endX));
        const rectRight = Math.min(left + width, Math.max(startX, endX));
        const rectWidth = rectRight - rectLeft;

        if (rectWidth > 0) {
            ctx.fillRect(rectLeft, top, rectWidth, bottom - top);
        }

        // 2. Draw vertical lines (only if they are within the chart area)
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(0, 255, 204, 0.7)';

        [startX, endX].forEach(xPos => {
            if (xPos >= left && xPos <= left + width) {
                ctx.beginPath();
                ctx.moveTo(xPos, top);
                ctx.lineTo(xPos, bottom);
                ctx.stroke();
            }
        });

        ctx.restore();
    }
};

// Global plugin for growth target visualization
const growthHighlightPlugin = {
    id: 'growthHighlight',
    afterDatasetsDraw(chart, args, options) {
        const { targetDate } = options;
        if (!targetDate) return;

        const { ctx, chartArea: { top, bottom, left, width }, scales: { x } } = chart;
        const targetTs = new Date(targetDate).getTime();
        const xPos = x.getPixelForValue(targetTs);

        if (xPos < left || xPos > left + width || isNaN(xPos)) return;

        ctx.save();

        // Draw vertical indicator line
        ctx.lineWidth = 2;
        ctx.setLineDash([]); // Solid line
        ctx.strokeStyle = '#FFCC00'; // Gold color to differentiate

        ctx.beginPath();
        ctx.moveTo(xPos, top);
        ctx.lineTo(xPos, bottom);
        ctx.stroke();

        // Draw "Refinement Baseline" label
        ctx.fillStyle = '#FFCC00';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('REFINEMENT BASELINE', xPos, top - 8);

        ctx.restore();
    }
};

ChartJS.register(comparisonHighlightPlugin, growthHighlightPlugin);

// 좌측 패닝/줌 경계: 2000년 1월 1일
const MIN_DATE = new Date(2000, 0, 1).getTime();

const ChartContainer = ({ datasets, title, timeRange, comparisonRange, refinementDate }) => {
    const chartRef = React.useRef(null);
    const containerRef = React.useRef(null);
    const [scaleUnit, setScaleUnit] = React.useState('day');
    const [internalRange, setInternalRange] = React.useState(() => {
        try {
            const saved = localStorage.getItem('cm_chart_range');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load chart range', e);
        }
        return { min: timeRange?.min, max: timeRange?.max };
    });
    const [internalYRange, setInternalYRange] = React.useState({ min: undefined, max: undefined });
    const [isDragging, setIsDragging] = React.useState(false);
    const dragData = React.useRef({ lastX: 0, lastY: 0 });
    // 휠 디바운스가 살아있는 동안 stale internalRange 대신 사용할 즉시 동기 뷰 상태
    const pendingViewRef = React.useRef(null);

    // Max Range는 선택한 Time Range에 맞춤 (선택 범위 이상 줌 아웃 불가)
    const currentMaxRange = React.useMemo(() => {
        if (timeRange && timeRange.min && timeRange.max) {
            return timeRange.max - timeRange.min;
        }
        return 10 * 365.25 * 24 * 60 * 60 * 1000; // fallback: 10 years
    }, [timeRange]);

    const isFirstTimeRangeEffect = React.useRef(true);
    React.useEffect(() => {
        if (isFirstTimeRangeEffect.current) {
            isFirstTimeRangeEffect.current = false;
            return;
        }
        // Time Range 드롭다운 변경 시에만 차트 윈도우를 리셋 (마운트 시 localStorage 값 보존)
        if (timeRange) {
            setInternalRange({ min: timeRange.min, max: timeRange.max });
        }
    }, [timeRange]);

    React.useEffect(() => {
        if (internalRange.min && internalRange.max) {
            localStorage.setItem('cm_chart_range', JSON.stringify(internalRange));
        }
    }, [internalRange]);

    const updateScaleUnit = (chart, silent = false) => {
        const { min, max } = chart.scales.x;
        const durationMs = max - min;
        const dayMs = 24 * 60 * 60 * 1000;
        const durationDays = durationMs / dayMs;

        let newUnit = 'day';
        if (durationDays > 365) {
            newUnit = 'month';
        } else if (durationDays > 30) {
            newUnit = 'week';
        }

        if (newUnit !== scaleUnit) {
            if (silent) {
                chart.options.scales.x.time.unit = newUnit;
            } else {
                // onComplete에서 setInternalRange를 이미 처리하므로 여기서는 unit만 동기화
                setScaleUnit(newUnit);
            }
        }
    };

    const handleMouseDown = (e) => {
        setIsDragging(true);
        dragData.current = { lastX: e.clientX, lastY: e.clientY, startX: e.clientX, startY: e.clientY };
    };

    const handleMouseMove = (e) => {
        if (!isDragging || !chartRef.current) return;

        const chart = chartRef.current;
        const deltaX = e.clientX - dragData.current.lastX;
        const deltaY = e.clientY - dragData.current.lastY;
        dragData.current.lastX = e.clientX;
        dragData.current.lastY = e.clientY;

        const now = new Date().getTime();
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        // X-axis Panning: Natural movement (graph follows mouse)
        const msPerPixel = (xScale.max - xScale.min) / xScale.width;
        let timeShift = -deltaX * msPerPixel;

        if (xScale.max + timeShift > now) {
            timeShift = now - xScale.max;
        }
        if (xScale.min + timeShift < MIN_DATE) {
            timeShift = MIN_DATE - xScale.min;
        }

        chart.options.scales.x.min = xScale.min + timeShift;
        chart.options.scales.x.max = xScale.max + timeShift;

        // Y-axis Panning: Natural movement (graph follows mouse)
        const valPerPixel = (yScale.max - yScale.min) / yScale.height;
        let yShift = deltaY * valPerPixel;

        chart.options.scales.y.min = yScale.min + yShift;
        chart.options.scales.y.max = yScale.max + yShift;

        updateScaleUnit(chart, true);
        chart.update('none');
    };

    const handleDragEnd = () => {
        if (isDragging && chartRef.current) {
            const dx = Math.abs(dragData.current.lastX - dragData.current.startX);
            const dy = Math.abs(dragData.current.lastY - dragData.current.startY);
            // 단순 클릭(< 3px)은 상태 저장 생략 — 클릭이 줌 리셋을 유발하는 현상 방지
            if (dx > 3 || dy > 3) {
                const chart = chartRef.current;
                setInternalRange({
                    min: chart.options.scales.x.min,
                    max: chart.options.scales.x.max
                });
                setInternalYRange({
                    min: chart.options.scales.y.min,
                    max: chart.options.scales.y.max
                });
            }
        }
        setIsDragging(false);
    };

    const wheelTimeout = React.useRef(null);
    const handleWheel = (e) => {
        if (!chartRef.current) return;
        const chart = chartRef.current;
        e.preventDefault();

        const { deltaX, deltaY } = e;
        const now = new Date().getTime();

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 1) {
            // 트랙패드 좌우 스와이프 → X축 팬
            const xScale = chart.scales.x;
            const msPerPixel = (xScale.max - xScale.min) / xScale.width;
            let timeShift = deltaX * msPerPixel * 0.8;

            if (xScale.max + timeShift > now) timeShift = now - xScale.max;
            if (xScale.min + timeShift < MIN_DATE) timeShift = MIN_DATE - xScale.min;

            chart.options.scales.x.min = xScale.min + timeShift;
            chart.options.scales.x.max = xScale.max + timeShift;

            pendingViewRef.current = {
                xMin: chart.options.scales.x.min,
                xMax: chart.options.scales.x.max,
                yMin: chart.options.scales.y?.min,
                yMax: chart.options.scales.y?.max,
            };

            updateScaleUnit(chart, true);
            chart.update('none');

            if (wheelTimeout.current) clearTimeout(wheelTimeout.current);
            wheelTimeout.current = setTimeout(() => {
                pendingViewRef.current = null;
                setInternalRange({ min: chart.options.scales.x.min, max: chart.options.scales.x.max });
            }, 500);

        } else if (Math.abs(deltaY) > 0) {
            // 세로 스크롤 → X+Y 동시 확대/축소 (마우스 위치 기준)
            const xScale = chart.scales.x;
            const yScale = chart.scales.y;
            const rect = containerRef.current.getBoundingClientRect();

            // 스크롤 다운 = 줌 아웃, 스크롤 업 = 줌 인
            const zoomFactor = deltaY > 0 ? 1.1 : 0.9;

            // --- X축: 마우스 X 위치 기준 줌 ---
            const currentXRange = xScale.max - xScale.min;
            let newXRange = currentXRange * zoomFactor;
            const minXRange = 7 * 24 * 60 * 60 * 1000;
            if (newXRange < minXRange) newXRange = minXRange;
            if (newXRange > currentMaxRange) newXRange = currentMaxRange;

            const mouseXOnChart = e.clientX - rect.left;
            const xRatio = Math.max(0, Math.min(1, (mouseXOnChart - xScale.left) / xScale.width));
            const mouseTime = xScale.min + xRatio * currentXRange;

            let newXMin = mouseTime - xRatio * newXRange;
            let newXMax = mouseTime + (1 - xRatio) * newXRange;
            if (newXMax > now) { newXMax = now; newXMin = Math.max(MIN_DATE, newXMax - newXRange); }
            if (newXMin < MIN_DATE) { newXMin = MIN_DATE; newXMax = Math.min(now, newXMin + newXRange); }

            chart.options.scales.x.min = newXMin;
            chart.options.scales.x.max = newXMax;

            // --- Y축: 마우스 Y 위치 기준 줌 (Y축은 위쪽이 max) ---
            const currentYRange = yScale.max - yScale.min;
            const newYRange = currentYRange * zoomFactor;

            const mouseYOnChart = e.clientY - rect.top;
            const yRatio = Math.max(0, Math.min(1, (mouseYOnChart - yScale.top) / yScale.height));
            const mouseYValue = yScale.max - yRatio * currentYRange;

            chart.options.scales.y.min = mouseYValue - (1 - yRatio) * newYRange;
            chart.options.scales.y.max = mouseYValue + yRatio * newYRange;

            pendingViewRef.current = {
                xMin: chart.options.scales.x.min,
                xMax: chart.options.scales.x.max,
                yMin: chart.options.scales.y.min,
                yMax: chart.options.scales.y.max,
            };

            updateScaleUnit(chart, true);
            chart.update('none');

            if (wheelTimeout.current) clearTimeout(wheelTimeout.current);
            wheelTimeout.current = setTimeout(() => {
                pendingViewRef.current = null;
                setInternalRange({ min: chart.options.scales.x.min, max: chart.options.scales.x.max });
                setInternalYRange({ min: chart.options.scales.y.min, max: chart.options.scales.y.max });
                updateScaleUnit(chart, false);
            }, 500);
        }
    };

    // handleWheel을 ref로 감싸서 렌더마다 재등록하지 않고 항상 최신 구현을 호출
    const handleWheelRef = React.useRef(null);
    handleWheelRef.current = handleWheel;

    React.useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const stableHandler = (e) => handleWheelRef.current(e);
        el.addEventListener('wheel', stableHandler, { passive: false });
        return () => el.removeEventListener('wheel', stableHandler);
    }, []);

    const chartData = {
        datasets: datasets.map((ds, index) => {
            // Color cycle
            const hue = (index * 137.5) % 360;
            const color = `hsl(${hue}, 80%, 60%)`;
            const bgColor = `hsla(${hue}, 80%, 60%, 0.1)`;

            return {
                label: ds.label,
                data: ds.data,
                borderColor: color,
                backgroundColor: bgColor,
                borderWidth: 2,
                pointRadius: 0,
                pointHitRadius: 10,
                fill: datasets.length === 1, // 하나일 때만 영역 채우기
                tension: 0.1,
                parsing: false, // Performance for Decimation
                normalized: true // Data is sorted by date from backend
            };
        })
    };


    const options = {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: {
                bottom: 50
            }
        },
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: '#A0A0A0'
                }
            },
            title: {
                display: !!title,
                text: title,
                color: '#FFFFFF',
                font: { size: 16 }
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        const label = context.dataset.label || '';
                        const currentVal = context.parsed.y;
                        let text = `${label}: ${currentVal.toLocaleString()}`;

                        if (context.dataIndex > 0) {
                            const rawPrev = context.dataset.data[context.dataIndex - 1];
                            const prevVal = typeof rawPrev === 'object' && rawPrev !== null ? rawPrev.y : rawPrev;
                            const diff = currentVal - prevVal;

                            if (diff > 0) {
                                text += ` (▲ +${diff.toLocaleString()})`;
                            } else if (diff < 0) {
                                text += ` (▼ ${diff.toLocaleString()})`;
                            } else {
                                text += ` (-)`;
                            }
                        }
                        return text;
                    }
                }
            },
            comparisonHighlight: {
                range: comparisonRange
            },
            growthHighlight: {
                targetDate: refinementDate
            },
            decimation: {
                enabled: true,
                algorithm: 'lttb',
                samples: 500, // 가로 해상도에 맞춰 적절히 조절
            },
            zoom: {
                // 휠/핀치/팬 모두 수동 구현 — 플러그인 간섭 없이 X+Y 동시 제어
                pan: { enabled: false },
                zoom: {
                    wheel: { enabled: false },
                    pinch: { enabled: false },
                    drag: { enabled: false },
                    mode: 'xy',
                }
            }
        },
        scales: {
            x: {
                type: 'time',
                min: pendingViewRef.current?.xMin ?? internalRange.min,
                max: pendingViewRef.current?.xMax ?? internalRange.max,
                time: {
                    unit: scaleUnit,
                    tooltipFormat: 'yyyy/MM/dd',
                    displayFormats: {
                        day: 'yyyy/MM/dd',
                        week: 'yyyy/MM/dd',
                        month: 'yyyy/MM',
                        year: 'yyyy'
                    }
                },
                stepSize: 1,
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: '#A0A0A0',
                    font: { size: 11 },
                    autoSkip: ((pendingViewRef.current?.xMax ?? internalRange.max) - (pendingViewRef.current?.xMin ?? internalRange.min)) >= (30 * 24 * 60 * 60 * 1000),
                    minRotation: 45,
                    maxRotation: 45,
                    callback: function (value, index, ticks_list) {
                        const tick = ticks_list[index];
                        if (!tick || tick.value === undefined) return value;

                        const date = new Date(tick.value);
                        const year = date.getFullYear();
                        const month = date.getMonth();
                        const day = date.getDate();

                        let isNewYear = false;
                        if (index > 0 && ticks_list[index - 1]) {
                            const prevDate = new Date(ticks_list[index - 1].value);
                            if (prevDate.getFullYear() !== year) {
                                isNewYear = true;
                            }
                        }

                        if (index === 0 || isNewYear) {
                            const yyyy = year;
                            const mm = String(month + 1).padStart(2, '0');
                            const dd = String(day).padStart(2, '0');
                            return `${yyyy}/${mm}/${dd}`;
                        } else {
                            const mm = String(month + 1).padStart(2, '0');
                            const dd = String(day).padStart(2, '0');
                            return `${mm}/${dd}`;
                        }
                    }
                }
            },
            y: {
                min: pendingViewRef.current?.yMin ?? internalYRange.min,
                max: pendingViewRef.current?.yMax ?? internalYRange.max,
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: '#A0A0A0'
                }
            }
        }
    };

    const handleZoom = (direction) => {
        if (!chartRef.current) return;
        const chart = chartRef.current;
        const xScale = chart.scales.x;
        const currentRange = xScale.max - xScale.min;
        const center = xScale.min + currentRange / 2;

        const factor = direction === 'in' ? 0.8 : 1.2;
        let newRange = currentRange * factor;

        const minRange = 7 * 24 * 60 * 60 * 1000;
        if (newRange < minRange) newRange = minRange;
        if (newRange > currentMaxRange) newRange = currentMaxRange;

        let newMin = center - newRange / 2;
        let newMax = center + newRange / 2;

        const now = new Date().getTime();
        if (newMax > now) {
            newMax = now;
            newMin = Math.max(MIN_DATE, newMax - newRange);
        }
        if (newMin < MIN_DATE) {
            newMin = MIN_DATE;
            newMax = Math.min(now, newMin + newRange);
        }

        chart.options.scales.x.min = newMin;
        chart.options.scales.x.max = newMax;
        updateScaleUnit(chart, true);
        chart.update('none');
        setInternalRange({ min: newMin, max: newMax });
    };

    const handlePan = (direction) => {
        if (!chartRef.current) return;
        const chart = chartRef.current;
        const xScale = chart.scales.x;
        const currentRange = xScale.max - xScale.min;

        const shiftAmount = currentRange * 0.3;
        const timeShift = direction === 'left' ? -shiftAmount : shiftAmount;

        let newMin = xScale.min + timeShift;
        let newMax = xScale.max + timeShift;

        const now = new Date().getTime();
        if (newMax > now) {
            newMax = now;
            newMin = newMax - currentRange;
        }
        if (newMin < MIN_DATE) {
            newMin = MIN_DATE;
            newMax = newMin + currentRange;
        }

        chart.options.scales.x.min = newMin;
        chart.options.scales.x.max = newMax;
        updateScaleUnit(chart, true);
        chart.update('none');
        setInternalRange({ min: newMin, max: newMax });
    };

    const handleReset = () => {
        if (!chartRef.current || !timeRange) return;
        const chart = chartRef.current;
        chart.options.scales.x.min = timeRange.min;
        chart.options.scales.x.max = timeRange.max;
        chart.options.scales.y.min = undefined;
        chart.options.scales.y.max = undefined;
        updateScaleUnit(chart, true);
        chart.update('none');
        setInternalRange({ min: timeRange.min, max: timeRange.max });
        setInternalYRange({ min: undefined, max: undefined });
    };

    return (
        <div
            ref={containerRef}
            className="chart-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            style={{ cursor: isDragging ? 'grabbing' : 'grab', position: 'relative' }}
        >
            <div style={{ flex: 1, position: 'relative' }}>
                <div className="chart-toolbar">
                    <button className="chart-toolbar-btn" onClick={() => handlePan('left')} title="Pan Left">
                        <FiArrowLeft />
                    </button>
                    <button className="chart-toolbar-btn" onClick={() => handlePan('right')} title="Pan Right">
                        <FiArrowRight />
                    </button>
                    <div className="chart-toolbar-divider" />
                    <button className="chart-toolbar-btn" onClick={() => handleZoom('in')} title="Zoom In">
                        <FiZoomIn />
                    </button>
                    <button className="chart-toolbar-btn" onClick={() => handleZoom('out')} title="Zoom Out">
                        <FiZoomOut />
                    </button>
                    <div className="chart-toolbar-divider" />
                    <button className="chart-toolbar-btn" onClick={handleReset} title="Reset View">
                        <FiRefreshCcw />
                    </button>
                </div>
                <Line
                    ref={chartRef}
                    data={chartData}
                    options={options}
                />
            </div>
        </div>
    );
};

export default ChartContainer;
