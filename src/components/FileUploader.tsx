import React, { useCallback } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '../lib/utils';

interface FileUploaderProps {
    onFileSelect: (file: File) => void;
    isDragActive?: boolean;
}

export function FileUploader({ onFileSelect }: FileUploaderProps) {
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            onFileSelect(files[0]);
        }
    }, [onFileSelect]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            onFileSelect(files[0]);
        }
    }, [onFileSelect]);

    return (
        <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={cn(
                "border-2 border-dashed border-gray-300 rounded-xl p-8 text-center",
                "hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer",
                "flex flex-col items-center justify-center gap-4 group"
            )}
        >
            <input
                type="file"
                accept=".csv"
                onChange={handleChange}
                className="hidden"
                id="file-upload"
            />
            <div className="p-4 bg-gray-100 rounded-full group-hover:bg-blue-100 transition-colors">
                <UploadCloud className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
            <div>
                <label htmlFor="file-upload" className="text-lg font-medium text-gray-700 cursor-pointer">
                    <span className="text-blue-600 hover:underline">Click to upload</span> or drag and drop
                </label>
                <p className="text-sm text-gray-500 mt-1">CSV bank export files</p>
            </div>
        </div>
    );
}
