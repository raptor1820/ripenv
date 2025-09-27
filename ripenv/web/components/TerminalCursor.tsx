"use client";

import { useEffect, useState } from "react";

export function TerminalCursor() {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const updateMousePosition = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (
                target.tagName === "BUTTON" ||
                target.tagName === "A" ||
                target.tagName === "INPUT" ||
                target.classList.contains("cursor-hover")
            ) {
                setIsVisible(false);
                // Restore normal cursor for input elements
                if (target.tagName === "INPUT") {
                    target.style.cursor = "text";
                } else {
                    target.style.cursor = "pointer";
                }
            } else {
                setIsVisible(true);
            }
        };

        document.addEventListener("mousemove", updateMousePosition);
        document.addEventListener("mouseover", handleMouseOver);
        document.body.style.cursor = "none";

        return () => {
            document.removeEventListener("mousemove", updateMousePosition);
            document.removeEventListener("mouseover", handleMouseOver);
            document.body.style.cursor = "auto";
        };
    }, []);

    if (!isVisible) return null;

    return (
        <div
            className="pointer-events-none fixed z-50 terminal-cursor"
            style={{
                left: mousePosition.x - 4,
                top: mousePosition.y - 8,
            }}>
            <div className="h-6 w-4 bg-green-400 animate-pulse shadow-lg shadow-green-400/50"></div>
        </div>
    );
}
