"use client";

import { useEffect, useState } from "react";
import { Bell, X, Clock, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";
import { showToast } from "@/components/Toast";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadNotifications();

        // Subscribe to new notifications
        const channel = supabase
            .channel("notifications")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "notifications" },
                (payload) => {
                    console.log("New notification received:", payload);
                    const newNotification = payload.new as Notification;
                    setNotifications((prev) => [newNotification, ...prev]);

                    // Show toast for new notification
                    console.log(
                        "Attempting to show toast:",
                        newNotification.title,
                        newNotification.message
                    );
                    showToast(
                        newNotification.title,
                        newNotification.message,
                        newNotification.type === "rotation_reminder"
                            ? "warning"
                            : "info"
                    );
                }
            )
            .subscribe((status) => {
                console.log("Notification subscription status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function loadNotifications() {
        try {
            const { data, error } = await supabase
                .from("notifications")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(10);

            if (error) throw error;
            setNotifications((data as Notification[]) || []);
        } catch (error) {
            console.error("Failed to load notifications:", error);
        } finally {
            setLoading(false);
        }
    }

    async function markAsRead(notificationId: string) {
        try {
            const { error } = await supabase
                .from("notifications")
                .update({ read: true })
                .eq("id", notificationId);

            if (error) throw error;

            setNotifications((prev) =>
                prev.map((n) =>
                    n.id === notificationId ? { ...n, read: true } : n
                )
            );
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
        }
    }

    async function clearNotification(notificationId: string) {
        try {
            const { error } = await supabase
                .from("notifications")
                .delete()
                .eq("id", notificationId);

            if (error) throw error;

            setNotifications((prev) =>
                prev.filter((n) => n.id !== notificationId)
            );
        } catch (error) {
            console.error("Failed to clear notification:", error);
        }
    }

    const unreadCount = notifications.filter((n) => !n.read).length;

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case "rotation_reminder":
                return <Shield className="h-4 w-4 text-orange-400" />;
            case "security":
                return <Shield className="h-4 w-4 text-red-400" />;
            default:
                return <Clock className="h-4 w-4 text-blue-400" />;
        }
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    return (
        <div className="relative">
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="relative p-2 text-slate-400 hover:text-slate-200 transition-colors"
                title="Notifications">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {showDropdown && (
                <div className="absolute right-0 mt-2 w-96 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                    <div className="p-4 border-b border-slate-700">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-200">
                                Notifications
                            </h3>
                            <button
                                onClick={() => setShowDropdown(false)}
                                className="p-1 hover:bg-slate-700 rounded"
                                title="Close notifications">
                                <X className="h-4 w-4 text-slate-400" />
                            </button>
                        </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 text-center text-slate-400">
                                Loading notifications...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-4 text-center text-slate-400">
                                No notifications yet
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${
                                        !notification.read
                                            ? "bg-slate-700/20"
                                            : ""
                                    }`}>
                                    <div className="flex items-start gap-3">
                                        {getNotificationIcon(notification.type)}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between">
                                                <h4
                                                    className={`text-sm font-medium ${
                                                        !notification.read
                                                            ? "text-slate-100"
                                                            : "text-slate-300"
                                                    }`}>
                                                    {notification.title}
                                                </h4>
                                                <button
                                                    onClick={() =>
                                                        clearNotification(
                                                            notification.id
                                                        )
                                                    }
                                                    className="p-1 hover:bg-slate-600 rounded ml-2"
                                                    title="Clear notification">
                                                    <X className="h-3 w-3 text-slate-500" />
                                                </button>
                                            </div>
                                            <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                                                {notification.message}
                                            </p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-slate-500">
                                                    {formatTimeAgo(
                                                        notification.created_at!
                                                    )}
                                                </span>
                                                {!notification.read && (
                                                    <button
                                                        onClick={() =>
                                                            markAsRead(
                                                                notification.id
                                                            )
                                                        }
                                                        className="text-xs text-blue-400 hover:text-blue-300">
                                                        Mark as read
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-slate-700 text-center">
                            <button
                                onClick={() => {
                                    // Mark all as read
                                    notifications.forEach((n) => {
                                        if (!n.read) markAsRead(n.id);
                                    });
                                }}
                                className="text-sm text-blue-400 hover:text-blue-300">
                                Mark all as read
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Backdrop */}
            {showDropdown && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDropdown(false)}
                />
            )}
        </div>
    );
}
