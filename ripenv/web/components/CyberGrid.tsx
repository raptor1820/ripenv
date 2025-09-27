"use client";

import { useEffect, useState } from "react";

export function CyberGrid() {
    const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

    useEffect(() => {
        const updateMousePos = (e: MouseEvent) => {
            setMousePos({
                x: (e.clientX / window.innerWidth) * 100,
                y: (e.clientY / window.innerHeight) * 100,
            });
        };

        document.addEventListener("mousemove", updateMousePos);
        return () => document.removeEventListener("mousemove", updateMousePos);
    }, []);

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* Animated grid lines */}
            <div className="cyber-grid-container">
                <div className="cyber-grid-horizontal" />
                <div className="cyber-grid-vertical" />
            </div>

            {/* Pulsing nodes at intersections */}
            <div className="cyber-nodes">
                {Array.from({ length: 20 }).map((_, i) => (
                    <div
                        key={i}
                        className="cyber-node"
                        style={{
                            left: `${(i % 5) * 25 + 10}%`,
                            top: `${Math.floor(i / 5) * 25 + 10}%`,
                            animationDelay: `${i * 0.2}s`,
                        }}
                    />
                ))}
            </div>

            {/* Scanning lines */}
            <div className="scanner-line-horizontal" />
            <div className="scanner-line-vertical" />

            {/* Glitch overlay */}
            <div className="glitch-overlay" />
        </div>
    );
}
