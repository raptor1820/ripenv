"use client";

import { useEffect, useState } from "react";

interface MousePosition {
    x: number;
    y: number;
}

export function CustomCursor() {
    const [mousePosition, setMousePosition] = useState<MousePosition>({
        x: 0,
        y: 0,
    });
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        const updateMousePosition = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (
                target.tagName === "BUTTON" ||
                target.tagName === "A" ||
                target.classList.contains("cursor-hover")
            ) {
                setIsHovering(true);
            } else {
                setIsHovering(false);
            }
        };

        document.addEventListener("mousemove", updateMousePosition);
        document.addEventListener("mouseover", handleMouseOver);

        return () => {
            document.removeEventListener("mousemove", updateMousePosition);
            document.removeEventListener("mouseover", handleMouseOver);
        };
    }, []);

    return (
        <>
            <div
                className="pointer-events-none fixed z-50 mix-blend-difference transition-transform duration-100 ease-out"
                style={{
                    left: mousePosition.x - 10,
                    top: mousePosition.y - 10,
                    transform: isHovering ? "scale(2)" : "scale(1)",
                }}>
                <div className="h-5 w-5 rounded-full bg-white"></div>
            </div>
            <div
                className="pointer-events-none fixed z-40 opacity-50 transition-transform duration-200 ease-out"
                style={{
                    left: mousePosition.x - 20,
                    top: mousePosition.y - 20,
                    transform: isHovering ? "scale(1.5)" : "scale(1)",
                }}>
                <div className="h-10 w-10 rounded-full border border-white/30"></div>
            </div>
        </>
    );
}
