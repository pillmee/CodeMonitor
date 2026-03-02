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
// 좌측 패닝/줌 경계: 2000년 1월 1일
const MIN_DATE = new Date(2000, 0, 1).getTime();

const ChartContainer = ({ datasets, title, timeRange }) => {
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
    const dragData = React.useRef({ isDragging: false, lastX: 0 });

    // Max Range는 선택한 Time Range에 맞춤 (선택 범위 이상 줌 아웃 불가)
    const currentMaxRange = React.useMemo(() => {
        if (timeRange && timeRange.min && timeRange.max) {
            return timeRange.max - timeRange.min;
        }
        return 10 * 365.25 * 24 * 60 * 60 * 1000; // fallback: 10 years
    }, [timeRange]);

    React.useEffect(() => {
        if (timeRange) {
            // 부모에서 timeRange가 명시적으로 변경되면(드롭다운 등) 내부 범위를 초기화
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
                // 인스턴스 옵션에 직접 반영하여 리렌더링 없이 눈금 업데이트 준비
                chart.options.scales.x.time.unit = newUnit;
            } else {
                // 인터랙션 종료 시점에만 React 상태와 동기화하여 리렌더링 유도
                setInternalRange({ min, max });
                setScaleUnit(newUnit);
            }
        }
    };

    const handleMouseDown = (e) => {
        dragData.current = { isDragging: true, lastX: e.clientX };
    };

    const handleMouseMove = (e) => {
        if (!dragData.current.isDragging || !chartRef.current) return;

        const chart = chartRef.current;
        const deltaX = e.clientX - dragData.current.lastX;
        dragData.current.lastX = e.clientX;

        // Panning Speed / Damping factor: 0.2
        const dampingFactor = 0.2;
        const now = new Date().getTime();

        const xScale = chart.scales.x;
        const msPerPixel = (xScale.max - xScale.min) / xScale.width;

        // Natural Panning Fix: 
        // 마우스 왼쪽 이동(deltaX < 0) 시 좌측(과거) 시점(값 감소)으로 이동
        let timeShift = deltaX * msPerPixel * dampingFactor;

        // Future Date Restriction:
        // 새로운 max값이 현재 시간을 넘지 않도록 제한
        if (xScale.max + timeShift > now) {
            timeShift = now - xScale.max;
        }

        // Past Date Restriction:
        // 새로운 min값이 2000-01-01 이전으로 가지 않도록 제한
        if (xScale.min + timeShift < MIN_DATE) {
            timeShift = MIN_DATE - xScale.min;
        }

        // 고성능을 위해 직접 옵션 수정 후 업데이트
        chart.options.scales.x.min = xScale.min + timeShift;
        chart.options.scales.x.max = xScale.max + timeShift;

        // 조작 중에는 silent하게 단위 체크 (옵션만 변경)
        updateScaleUnit(chart, true);

        chart.update('none'); // 애니메이션 없이 즉시 렌더링
    };

    const handleMouseUp = () => {
        if (dragData.current.isDragging && chartRef.current) {
            const chart = chartRef.current;
            setInternalRange({
                min: chart.options.scales.x.min,
                max: chart.options.scales.x.max
            });
        }
        dragData.current.isDragging = false;
    };

    const wheelTimeout = React.useRef(null);
    const handleWheel = (e) => {
        // Ctrl 키가 눌린 채로 휠/트랙패드 조작 시에는 줌 플러그인이 처리하도록 무시
        if (e.ctrlKey) return;
        if (!chartRef.current) return;

        // 트랙패드 좌우 스와이프 시 브라우저의 '뒤로 가기/앞으로 가기' 방지
        e.preventDefault();

        const chart = chartRef.current;
        const deltaX = e.deltaX;
        if (Math.abs(deltaX) < 1) return; // 미세한 움직임 무시

        // 트랙패드 좌우 스와이프를 이동(Pan)으로 변환
        const xScale = chart.scales.x;
        const msPerPixel = (xScale.max - xScale.min) / xScale.width;

        // 맥북 트랙패드 방향과 일치시키기 위해 deltaX 사용 (자연스러운 스크롤)
        let timeShift = deltaX * msPerPixel * 0.8; // 0.8은 감도 조절값

        const now = new Date().getTime();
        if (xScale.max + timeShift > now) {
            timeShift = now - xScale.max;
        }

        // Past Date Restriction: 2000-01-01 이전으로 이동 불가
        if (xScale.min + timeShift < MIN_DATE) {
            timeShift = MIN_DATE - xScale.min;
        }

        chart.options.scales.x.min = xScale.min + timeShift;
        chart.options.scales.x.max = xScale.max + timeShift;

        updateScaleUnit(chart, true);
        chart.update('none');

        // 스크롤 중지 후 500ms 뒤에 상태 동기화 (요약 카드 업데이트용)
        if (wheelTimeout.current) clearTimeout(wheelTimeout.current);
        wheelTimeout.current = setTimeout(() => {
            setInternalRange({
                min: chart.options.scales.x.min,
                max: chart.options.scales.x.max
            });
        }, 500);
    };

    // Native DOM listener로 wheel 이벤트 등록 (passive: false 필수)
    // React의 onWheel은 passive 리스너로 등록되어 preventDefault()가 무시됨
    React.useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    });

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
        responsive: true,
        maintainAspectRatio: false,
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
            decimation: {
                enabled: true,
                algorithm: 'lttb',
                samples: 500, // 가로 해상도에 맞춰 적절히 조절
            },
            zoom: {
                limits: {
                    x: {
                        minRange: 7 * 24 * 60 * 60 * 1000, // 최소 확대 범위를 7일로 제한
                        maxRange: currentMaxRange, // 선택한 Time Range 이상 줌 아웃 불가
                        min: MIN_DATE, // 좌측 한계: 2000-01-01
                        max: new Date().getTime() // 최우측(미래) 제한
                    },
                },
                pan: {
                    enabled: false, // 커스텀 팬 구현을 위해 비활성화
                },
                zoom: {
                    wheel: {
                        enabled: true,
                        speed: 0.1, // 반응성 향상을 위해 0.02에서 0.1로 상향
                        modifierKey: 'ctrl', // 트랙패드 좌우 스와이프 시 줌 오작동 방지 (Pinch 줌은 자동 Ctrl 인식)
                    },
                    pinch: {
                        enabled: true
                    },
                    drag: {
                        enabled: false,
                    },
                    mode: 'x',
                    onZoom: ({ chart }) => {
                        const { min, max } = chart.scales.x;
                        const minRange = 7 * 24 * 60 * 60 * 1000;
                        if (max - min < minRange) {
                            // 혹시라도 한계를 넘으려 할 경우 정지
                            return false;
                        }
                        // 줌 조작 중에도 리렌더링 없이 조용히 단위 업데이트
                        updateScaleUnit(chart, true);
                    },
                    onComplete: ({ chart }) => {
                        setInternalRange({ min: chart.scales.x.min, max: chart.scales.x.max });
                        updateScaleUnit(chart);
                    }
                }
            }
        },
        scales: {
            x: {
                type: 'time',
                min: internalRange.min,
                max: internalRange.max,
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
                stepSize: 1, // 일 단위일 때 매일 표시되도록 유도
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: '#A0A0A0',
                    autoSkip: (internalRange.max - internalRange.min) >= (30 * 24 * 60 * 60 * 1000), // 30일 미만이면 모든 날짜 표시
                    minRotation: 45,
                    maxRotation: 45,
                    callback: function (value, index, ticks_list) {
                        const tick = ticks_list[index];
                        if (!tick || tick.value === undefined) return value;

                        const date = new Date(tick.value);
                        const year = date.getFullYear();
                        const month = date.getMonth();
                        const day = date.getDate();

                        // 이전 눈금과의 연도 비교
                        let isNewYear = false;
                        if (index > 0 && ticks_list[index - 1]) {
                            const prevDate = new Date(ticks_list[index - 1].value);
                            if (prevDate.getFullYear() !== year) {
                                isNewYear = true;
                            }
                        }

                        // 첫 번째 눈금이거나 새로운 해가 시작되는 눈금인 경우 연도 포함 표시
                        if (index === 0 || isNewYear) {
                            const yyyy = year;
                            const mm = String(month + 1).padStart(2, '0');
                            const dd = String(day).padStart(2, '0');
                            return `${yyyy}/${mm}/${dd}`;
                        } else {
                            // 그 외에는 MM/dd 형식으로 표시
                            const mm = String(month + 1).padStart(2, '0');
                            const dd = String(day).padStart(2, '0');
                            return `${mm}/${dd}`;
                        }
                    }
                }
            },
            y: {
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

        // 방향에 따라 20% 범위 확대(in) 혹은 축소(out)
        const factor = direction === 'in' ? 0.8 : 1.2;
        let newRange = currentRange * factor;

        // Limiting limits: min 7 days, max = selected timeRange width
        const minRange = 7 * 24 * 60 * 60 * 1000;
        if (newRange < minRange) newRange = minRange;
        if (newRange > currentMaxRange) newRange = currentMaxRange;

        let newMin = center - newRange / 2;
        let newMax = center + newRange / 2;

        const now = new Date().getTime();
        // Shift if it exceeds future bound
        if (newMax > now) {
            newMax = now;
            newMin = Math.max(MIN_DATE, newMax - newRange);
        }
        // Shift if it exceeds past bound
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

        // 이동량: 현재 보이는 범위의 30%
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
        updateScaleUnit(chart, true);
        chart.update('none');
        setInternalRange({ min: timeRange.min, max: timeRange.max });
    };

    return (
        <div
            ref={containerRef}
            className="chart-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: dragData.current.isDragging ? 'grabbing' : 'grab', position: 'relative' }}
        >
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

            <div style={{ flex: 1, position: 'relative' }}>
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
