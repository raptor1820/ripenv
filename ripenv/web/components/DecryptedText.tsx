"use client";

import { useEffect, useState } from "react";

interface DecryptedTextProps {
    text: string;
    className?: string;
    interval?: number;
    enableHover?: boolean;
}

export function DecryptedText({
    text,
    className = "",
    interval = 50,
    enableHover = false,
}: DecryptedTextProps) {
    const [displayText, setDisplayText] = useState(text); // Start with full text
    const [isDecrypted, setIsDecrypted] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovering, setIsHovering] = useState(false);

    const chars = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~";

    // Auto-decrypt on mount
    useEffect(() => {
        const startDecryption = setTimeout(() => {
            setIsDecrypted(true);
            setCurrentIndex(0);
        }, 1000);

        return () => clearTimeout(startDecryption);
    }, []);

    // Handle decryption animation
    useEffect(() => {
        if (isDecrypted && currentIndex < text.length && !isHovering) {
            const timeout = setTimeout(() => {
                const randomChar =
                    chars[Math.floor(Math.random() * chars.length)];

                const iterations = 3;
                let iterationCount = 0;

                const revealInterval = setInterval(() => {
                    if (iterationCount < iterations) {
                        setDisplayText(
                            text.substring(0, currentIndex) +
                                randomChar +
                                text.substring(currentIndex + 1)
                        );
                        iterationCount++;
                    } else {
                        setDisplayText(text);
                        setCurrentIndex(currentIndex + 1);
                        clearInterval(revealInterval);
                    }
                }, interval / 6);
            }, interval / 2);
            return () => clearTimeout(timeout);
        }
    }, [currentIndex, text, chars, interval, isDecrypted, isHovering]);

    const handleHover = () => {
        if (!enableHover) return;

        setIsHovering(true);

        // Encrypt on hover
        let encryptIndex = 0;
        const encryptInterval = setInterval(() => {
            if (encryptIndex >= text.length) {
                clearInterval(encryptInterval);

                // Start decrypting again after encryption
                setTimeout(() => {
                    let decryptIndex = 0;
                    const decryptInterval = setInterval(() => {
                        if (decryptIndex >= text.length) {
                            clearInterval(decryptInterval);
                            setIsHovering(false);
                            return;
                        }

                        const randomChar =
                            chars[Math.floor(Math.random() * chars.length)];
                        setDisplayText(
                            text.substring(0, decryptIndex) +
                                randomChar +
                                text.substring(decryptIndex + 1)
                        );

                        setTimeout(() => {
                            setDisplayText(
                                text.substring(0, decryptIndex + 1) +
                                    text.substring(decryptIndex + 1)
                            );
                            decryptIndex++;
                        }, interval / 6);
                    }, interval / 2);
                }, 200);

                return;
            }

            const randomChar = chars[Math.floor(Math.random() * chars.length)];
            setDisplayText(
                text.substring(0, text.length - encryptIndex - 1) +
                    randomChar +
                    text.substring(text.length - encryptIndex)
            );
            encryptIndex++;
        }, interval / 4);
    };

    const handleMouseLeave = () => {
        if (!enableHover) return;
        setIsHovering(false);
    };

    return (
        <span
            className={`${className} ${enableHover ? "cursor-none" : ""}`}
            onMouseEnter={handleHover}
            onMouseLeave={handleMouseLeave}>
            {displayText}
            {isDecrypted && currentIndex < text.length && !isHovering && (
                <span className="animate-pulse text-green-400">|</span>
            )}
        </span>
    );
}
