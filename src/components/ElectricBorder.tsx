"use client"
import React, { ReactNode } from "react"
import "./ElectricBorder.css"

interface ElectricBorderProps {
  children?: ReactNode
  color?: string
  // speed / chaos are kept so existing call sites still compile; the effect is CSS-only now
  speed?: number
  chaos?: number
  borderRadius?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * Lightweight replacement for the old canvas-based border.
 * No requestAnimationFrame loop, no per-frame noise maths, no 32px blur layers.
 * The glow "breathes" using an opacity animation, which the browser runs on the GPU.
 */
const ElectricBorder: React.FC<ElectricBorderProps> = ({
  children,
  color = "#5227FF",
  borderRadius = 24,
  className,
  style,
}) => {
  const vars = { "--eb-color": color, borderRadius } as React.CSSProperties

  return (
    <div className={`electric-border ${className ?? ""}`} style={{ ...vars, ...style }}>
      <div className="eb-glow" aria-hidden="true" />
      <div className="eb-content">{children}</div>
      <div className="eb-ring" aria-hidden="true" />
    </div>
  )
}

export default ElectricBorder
