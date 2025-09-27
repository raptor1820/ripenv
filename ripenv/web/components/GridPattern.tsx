"use client";

import { useEffect, useState } from "react";

export function GridPattern() {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
            <div
                className="absolute inset-0 bg-grid-pattern transition-transform duration-300 ease-out"
                style={{
                    transform: `translate(${mousePos.x * 0.1}px, ${
                        mousePos.y * 0.1
                    }px)`,
                    backgroundImage: `
                        radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(99, 102, 241, 0.3) 0%, transparent 50%),
                        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)
                    `,
                    backgroundSize: "60px 60px",
                }}
            />
        </div>
    );
}
