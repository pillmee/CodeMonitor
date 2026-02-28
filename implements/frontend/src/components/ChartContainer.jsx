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
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
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
    zoomPlugin
);

const ChartContainer = ({ datasets, title }) => {
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
            zoom: {
                pan: {
                    enabled: true,
                    mode: 'x',
                },
                zoom: {
                    wheel: {
                        enabled: true,
                    },
                    pinch: {
                        enabled: true
                    },
                    mode: 'x',
                }
            }
        },
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'day',
                    tooltipFormat: 'PPpp'
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: '#A0A0A0'
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

    return (
        <div className="chart-container">
            <div style={{ flex: 1, position: 'relative' }}>
                <Line data={chartData} options={options} />
            </div>
        </div>
    );
};

export default ChartContainer;
