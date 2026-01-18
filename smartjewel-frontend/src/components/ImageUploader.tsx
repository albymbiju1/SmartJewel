import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';

interface ImageUploaderProps {
    onImageSelect: (file: File) => void;
    maxSizeMB?: number;
    acceptedFormats?: string[];
    previewImage?: string | null;
    onClear?: () => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
    onImageSelect,
    maxSizeMB = 5,
    acceptedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    previewImage,
    onClear
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateFile = (file: File): boolean => {
        setError(null);

        // Check file type
        if (!acceptedFormats.includes(file.type)) {
            setError(`Invalid file type. Please upload: ${acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`);
            return false;
        }

        // Check file size
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > maxSizeMB) {
            setError(`File size (${sizeMB.toFixed(1)}MB) exceeds ${maxSizeMB}MB limit`);
            return false;
        }

        return true;
    };

    const handleFile = (file: File) => {
        if (validateFile(file)) {
            onImageSelect(file);
        }
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleClear = () => {
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onClear?.();
    };

    return (
        <div className="w-full">
            {!previewImage ? (
                <div
                    className={`
            relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-all duration-200
            ${isDragging
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-300 hover:border-amber-400 hover:bg-gray-50'
                        }
          `}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={handleClick}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={acceptedFormats.join(',')}
                        onChange={handleFileInput}
                        className="hidden"
                    />

                    <div className="flex flex-col items-center space-y-3">
                        {/* Upload Icon */}
                        <svg
                            className="w-16 h-16 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>

                        <div>
                            <p className="text-lg font-medium text-gray-700">
                                {isDragging ? 'Drop image here' : 'Upload jewelry image'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                                Drag and drop or click to browse
                            </p>
                        </div>

                        <p className="text-xs text-gray-400">
                            Supported: JPG, PNG, WebP (Max {maxSizeMB}MB)
                        </p>
                    </div>
                </div>
            ) : (
                <div className="relative">
                    {/* Image Preview */}
                    <div className="relative rounded-lg overflow-hidden border-2 border-gray-200">
                        <img
                            src={previewImage}
                            alt="Upload preview"
                            className="w-full h-64 object-contain bg-gray-50"
                        />

                        {/* Clear Button */}
                        <button
                            onClick={handleClear}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-colors"
                            title="Remove image"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Change Image Button */}
                    <button
                        onClick={handleClick}
                        className="mt-3 w-full py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                        Change Image
                    </button>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600 flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        {error}
                    </p>
                </div>
            )}
        </div>
    );
};

export default ImageUploader;
