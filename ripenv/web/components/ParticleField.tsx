"use client";

import { useEffect, useState } from "react";

interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
}

export function ParticleField() {
    const [particles, setParticles] = useState<Particle[]>([]);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        let animationFrame: number;
        let particleId = 0;

        const updateMousePos = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };

        const createParticle = (x: number, y: number): Particle => ({
            id: particleId++,
            x,
            y,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 0,
            maxLife: 60 + Math.random() * 60,
        });

        const updateParticles = () => {
            setParticles((prev) => {
                let newParticles = [...prev];

                // Add new particles near mouse
                if (Math.random() < 0.3) {
                    const offsetX = (Math.random() - 0.5) * 100;
                    const offsetY = (Math.random() - 0.5) * 100;
                    newParticles.push(
                        createParticle(
                            mousePos.x + offsetX,
                            mousePos.y + offsetY
                        )
                    );
                }

                // Update existing particles
                newParticles = newParticles
                    .map((particle) => ({
                        ...particle,
                        x: particle.x + particle.vx,
                        y: particle.y + particle.vy,
                        life: particle.life + 1,
                        vx: particle.vx * 0.99,
                        vy: particle.vy * 0.99,
                    }))
                    .filter((particle) => particle.life < particle.maxLife)
                    .slice(-50); // Limit particles

                return newParticles;
            });

            animationFrame = requestAnimationFrame(updateParticles);
        };

        document.addEventListener("mousemove", updateMousePos);
        updateParticles();

        return () => {
            document.removeEventListener("mousemove", updateMousePos);
            cancelAnimationFrame(animationFrame);
        };
    }, [mousePos.x, mousePos.y]);

    return (
        <div className="pointer-events-none fixed inset-0 z-10">
            {particles.map((particle) => (
                <div
                    key={particle.id}
                    className="absolute h-1 w-1 rounded-full bg-brand-400"
                    style={{
                        left: particle.x,
                        top: particle.y,
                        opacity: 1 - particle.life / particle.maxLife,
                        transform: `scale(${
                            1 - particle.life / particle.maxLife
                        })`,
                    }}
                />
            ))}
        </div>
    );
}
