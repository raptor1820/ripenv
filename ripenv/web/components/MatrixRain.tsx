"use client";

import { useEffect, useState } from "react";

interface MatrixRainProps {
    className?: string;
}

export function MatrixRain({ className = "" }: MatrixRainProps) {
    const [drops, setDrops] = useState<
        Array<{
            id: number;
            x: number;
            y: number;
            speed: number;
            chars: string[];
        }>
    >([]);

    useEffect(() => {
        const characters =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;':\",./<>?`~".split(
                ""
            );
        const maxDrops = 50;
        let dropId = 0;

        const createDrop = () => ({
            id: dropId++,
            x: Math.random() * window.innerWidth,
            y: -Math.random() * 500,
            speed: Math.random() * 3 + 1,
            chars: Array.from(
                { length: Math.floor(Math.random() * 15) + 5 },
                () => characters[Math.floor(Math.random() * characters.length)]
            ),
        });

        const initialDrops = Array.from({ length: maxDrops }, createDrop);
        setDrops(initialDrops);

        const animationFrame = setInterval(() => {
            setDrops((prevDrops) =>
                prevDrops
                    .map((drop) => ({
                        ...drop,
                        y: drop.y + drop.speed,
                        chars:
                            Math.random() < 0.1
                                ? drop.chars.map(
                                      () =>
                                          characters[
                                              Math.floor(
                                                  Math.random() *
                                                      characters.length
                                              )
                                          ]
                                  )
                                : drop.chars,
                    }))
                    .filter((drop) => drop.y < window.innerHeight + 100)
                    .concat(
                        Array.from(
                            {
                                length: Math.max(
                                    0,
                                    maxDrops - prevDrops.length
                                ),
                            },
                            createDrop
                        )
                    )
            );
        }, 50);

        return () => clearInterval(animationFrame);
    }, []);

    return (
        <div
            className={`pointer-events-none absolute inset-0 overflow-hidden opacity-20 ${className}`}>
            {drops.map((drop) => (
                <div
                    key={drop.id}
                    className="absolute font-mono text-xs text-green-400"
                    style={{
                        left: drop.x,
                        top: drop.y,
                        transform: "translateX(-50%)",
                    }}>
                    {drop.chars.map((char, index) => (
                        <div
                            key={index}
                            className="leading-tight"
                            style={{
                                opacity: Math.max(0, 1 - index * 0.1),
                            }}>
                            {char}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
