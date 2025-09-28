"use client";

import { useEffect, useState } from "react";
import { X, Bell } from "lucide-react";

interface Toast {
    id: string;
    title: string;
    message: string;
    type: "success" | "info" | "warning" | "error";
}

let toastCount = 0;

// Global toast state
const toastSubscribers = new Set<(toasts: Toast[]) => void>();
let globalToasts: Toast[] = [];

function notifySubscribers() {
    toastSubscribers.forEach((callback) => callback([...globalToasts]));
}

export function showToast(
    title: string,
    message: string,
    type: Toast["type"] = "info"
) {
    console.log("showToast called with:", {
        title,
        message,
        type,
        toastsLength: globalToasts.length,
        subscribersCount: toastSubscribers.size,
    });

    const toast: Toast = {
        id: `toast-${++toastCount}`,
        title,
        message,
        type,
    };

    globalToasts.push(toast);
    console.log("Toast added to array, new length:", globalToasts.length);
    notifySubscribers();

    // Auto-remove after 5 seconds
    setTimeout(() => {
        globalToasts = globalToasts.filter((t) => t.id !== toast.id);
        notifySubscribers();
    }, 5000);
}

export function ToastContainer() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        console.log("ToastContainer: Adding subscriber");
        const subscriber = (newToasts: Toast[]) => {
            console.log("ToastContainer: Received toast update:", newToasts);
            setToasts(newToasts);
        };
        toastSubscribers.add(subscriber);
        return () => {
            console.log("ToastContainer: Removing subscriber");
            toastSubscribers.delete(subscriber);
        };
    }, []);

    const removeToast = (id: string) => {
        globalToasts = globalToasts.filter((t) => t.id !== id);
        notifySubscribers();
    };

    console.log("ToastContainer rendering with toasts:", toasts);

    const getTypeStyles = (type: Toast["type"]) => {
        switch (type) {
            case "success":
                return "border-green-500/30 bg-green-500/10 text-green-300";
            case "error":
                return "border-red-500/30 bg-red-500/10 text-red-300";
            case "warning":
                return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
            default:
                return "border-blue-500/30 bg-blue-500/10 text-blue-300";
        }
    };

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`min-w-80 max-w-96 p-4 rounded-lg border backdrop-blur-sm animate-in slide-in-from-right-full duration-300 ${getTypeStyles(
                        toast.type
                    )}`}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <Bell className="h-4 w-4" />
                                <h4 className="font-semibold text-sm">
                                    {toast.title}
                                </h4>
                            </div>
                            <p className="text-sm opacity-90">
                                {toast.message}
                            </p>
                        </div>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                            title="Dismiss">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
