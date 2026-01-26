import React from 'react';

interface DataPoint {
    label: string;
    value: number;
}

interface SimpleBarChartProps {
    data: DataPoint[];
    title?: string;
    color?: string;
    height?: number;
    valueFormatter?: (value: number) => string;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
    data,
    title,
    color = '#f59e0b',
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

    return (
        <div>
            {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}
            <div className="flex items-end justify-between gap-2" style={{ height }}>
                {data.map((item, index) => (
                    <div key={index} className="flex flex-col items-center flex-1 gap-2">
                        <div className="relative w-full flex items-end" style={{ height: height - 40 }}>
                            <div
                                className="w-full rounded-t-lg transition-all duration-300 hover:opacity-80 cursor-pointer relative group"
                                style={{
                                    height: `${(item.value / maxValue) * 100}%`,
                                    backgroundColor: color,
                                    minHeight: item.value > 0 ? '4px' : '0',
                                }}
                                title={`${item.label}: ${valueFormatter(item.value)}`}
                            >
                                {/* Tooltip on hover */}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                    {valueFormatter(item.value)}
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-600 text-center truncate w-full" title={item.label}>
                            {item.label}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};
