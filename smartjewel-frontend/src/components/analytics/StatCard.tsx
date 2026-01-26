import React from 'react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    color?: 'blue' | 'green' | 'purple' | 'amber' | 'red';
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    icon,
    trend,
    color = 'blue',
}) => {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        purple: 'bg-purple-50 text-purple-600',
        amber: 'bg-amber-50 text-amber-600',
        red: 'bg-red-50 text-red-600',
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500">{title}</h3>
                {icon && <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>}
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
            {trend && (
                <div className="mt-2 flex items-center text-sm">
                    {trend.isPositive ? (
                        <svg
                            className="w-4 h-4 text-green-500 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 10l7-7m0 0l7 7m-7-7v18"
                            />
                        </svg>
                    ) : (
                        <svg
                            className="w-4 h-4 text-red-500 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 14l-7 7m0 0l-7-7m7 7V3"
                            />
                        </svg>
                    )}
                    <span className={trend.isPositive ? 'text-green-600' : 'text-red-600'}>
                        {Math.abs(trend.value)}%
                    </span>
                    <span className="text-gray-500 ml-1">vs last period</span>
                </div>
            )}
        </div>
    );
};
