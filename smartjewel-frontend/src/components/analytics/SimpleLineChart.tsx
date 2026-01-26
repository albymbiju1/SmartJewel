import React from 'react';

interface DataPoint {
    label: string;
    value: number;
}

interface SimpleLineChartProps {
    data: DataPoint[];
    title?: string;
    color?: string;
    height?: number;
    valueFormatter?: (value: number) => string;
}

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({
    data,
    title,
    color = '#3b82f6',
    height = 300,
    valueFormatter = (v) => v.toLocaleString('en-IN'),
}) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center" style={{ height }}>
                <p className="text-gray-500">No data available</p>
            </div>
        );
    }

    const maxValue = Math.max(...data.map((d) => d.value));
    const minValue = Math.min(...data.map((d) => d.value));
    const range = maxValue - minValue;
    const chartHeight = height - 60;

    // Calculate SVG path
    const points = data.map((item, index) => {
        const x = (index / (data.length - 1 || 1)) * 100;
        const y = range > 0 ? ((maxValue - item.value) / range) * 100 : 50;
        return { x, y, value: item.value, label: item.label };
    });

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPathData = `${pathData} L 100 100 L 0 100 Z`;

    return (
        <div>
            {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}
            <div className="relative" style={{ height: chartHeight }}>
                <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="w-full h-full"
                    style={{ overflow: 'visible' }}
                >
                    {/* Area under the line */}
                    <path
                        d={areaPathData}
                        fill={color}
                        fillOpacity="0.1"
                        stroke="none"
                    />

                    {/* Line */}
                    <path
                        d={pathData}
                        fill="none"
                        stroke={color}
                        strokeWidth="0.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Data points */}
                    {points.map((point, index) => (
                        <g key={index}>
                            <circle
                                cx={point.x}
                                cy={point.y}
                                r="1.5"
                                fill={color}
                                className="cursor-pointer hover:r-2 transition-all"
                            >
                                <title>{`${point.label}: ${valueFormatter(point.value)}`}</title>
                            </circle>
                        </g>
                    ))}
                </svg>
            </div>

            {/* Labels */}
            <div className="flex justify-between mt-2">
                {data.map((item, index) => {
                    // Show only first, middle, and last labels to avoid crowding
                    const shouldShow =
                        index === 0 || index === data.length - 1 || index === Math.floor(data.length / 2);
                    return shouldShow ? (
                        <p key={index} className="text-xs text-gray-600 text-center">
                            {item.label}
                        </p>
                    ) : (
                        <div key={index} />
                    );
                })}
            </div>
        </div>
    );
};
