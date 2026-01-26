import React from 'react';

interface DataItem {
    label: string;
    value: number;
    color?: string;
}

interface SimplePieChartProps {
    data: DataItem[];
    title?: string;
    size?: number;
    valueFormatter?: (value: number) => string;
}

export const SimplePieChart: React.FC<SimplePieChartProps> = ({
    data,
    title,
    size = 200,
    valueFormatter = (v) => v.toLocaleString('en-IN'),
}) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center" style={{ height: size }}>
                <p className="text-gray-500">No data available</p>
            </div>
        );
    }

    const total = data.reduce((sum, item) => sum + item.value, 0);

    // Default colors if not provided
    const defaultColors = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#6366f1'];

    let currentAngle = -90; // Start from top
    const slices = data.map((item, index) => {
        const percentage = (item.value / total) * 100;
        const angle = (item.value / total) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;

        // Calculate path for pie slice
        const startX = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
        const startY = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
        const endX = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
        const endY = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
        const largeArc = angle > 180 ? 1 : 0;

        return {
            ...item,
            percentage,
            color: item.color || defaultColors[index % defaultColors.length],
            path: `M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArc} 1 ${endX} ${endY} Z`,
        };
    });

    return (
        <div>
            {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}
            <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Pie Chart */}
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 100 100"
                    className="flex-shrink-0"
                >
                    {slices.map((slice, index) => (
                        <g key={index}>
                            <path
                                d={slice.path}
                                fill={slice.color}
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                            >
                                <title>{`${slice.label}: ${valueFormatter(slice.value)} (${slice.percentage.toFixed(1)}%)`}</title>
                            </path>
                        </g>
                    ))}
                </svg>

                {/* Legend */}
                <div className="flex flex-col gap-2">
                    {slices.map((slice, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: slice.color }}
                            />
                            <div className="text-sm">
                                <span className="font-medium text-gray-900">{slice.label}</span>
                                <span className="text-gray-500 ml-2">
                                    {valueFormatter(slice.value)} ({slice.percentage.toFixed(1)}%)
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
