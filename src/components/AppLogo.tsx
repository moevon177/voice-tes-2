import React from "react";

interface AppLogoProps {
  className?: string;
  size?: number;
}

export default function AppLogo({ className = "", size = 100 }: AppLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} transition-transform duration-300 hover:scale-105`}
    >
      <defs>
        {/* Gradients for Hexagon Badge */}
        <radialGradient id="hexBackground" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1e344e" />
          <stop offset="70%" stopColor="#122033" />
          <stop offset="100%" stopColor="#0a121d" />
        </radialGradient>

        <linearGradient id="hexBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4c7fb5" />
          <stop offset="25%" stopColor="#81a8d0" />
          <stop offset="50%" stopColor="#254366" />
          <stop offset="75%" stopColor="#81a8d0" />
          <stop offset="100%" stopColor="#112133" />
        </linearGradient>

        <linearGradient id="innerHexBorder" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2a4563" />
          <stop offset="100%" stopColor="#0b131e" />
        </linearGradient>

        {/* Gradients for Chrome/Silver Key */}
        <linearGradient id="chromeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="20%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#cbd5e1" />
          <stop offset="50%" stopColor="#94a3b8" />
          <stop offset="55%" stopColor="#475569" />
          <stop offset="70%" stopColor="#cbd5e1" />
          <stop offset="90%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>

        {/* Diagonal reflections for shiny metal */}
        <linearGradient id="chromeAngled" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#cbd5e1" />
          <stop offset="50%" stopColor="#475569" />
          <stop offset="70%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>

        {/* Shadows */}
        <filter id="logoShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000000" floodOpacity="0.5" />
        </filter>
        
        <filter id="keyShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Main Hexagon Badge */}
      <g filter="url(#logoShadow)">
        {/* Outer Hexagon */}
        <polygon
          points="256,24 466,145 466,387 256,508 46,387 46,145"
          fill="url(#hexBackground)"
          stroke="url(#hexBorder)"
          strokeWidth="16"
          strokeLinejoin="round"
        />
        
        {/* Inner Hexagon Bevel */}
        <polygon
          points="256,42 446,151 446,379 256,488 66,379 66,151"
          fill="none"
          stroke="url(#innerHexBorder)"
          strokeWidth="6"
          strokeLinejoin="round"
          opacity="0.8"
        />

        {/* Highlight inner line */}
        <polygon
          points="256,48 438,154 438,374 256,480 74,374 74,154"
          fill="none"
          stroke="#426b9a"
          strokeWidth="1.5"
          opacity="0.3"
        />
      </g>

      {/* Metallic Key (SRF) */}
      <g filter="url(#keyShadow)">
        {/* Shaft of the Key */}
        <path
          d="M242 180 H270 V410 C270 415 264 420 256 420 C248 420 242 415 242 410 V180 Z"
          fill="url(#chromeGradient)"
        />
        
        {/* Key Shaft Central Ridge / Detail */}
        <path
          d="M252 240 H260 V402 H252 Z"
          fill="#1e293b"
          opacity="0.25"
        />
        
        {/* Key Collar (ring below S & R) */}
        <rect
          x="230"
          y="250"
          width="52"
          height="14"
          rx="6"
          fill="url(#chromeAngled)"
          stroke="#1e293b"
          strokeWidth="2"
        />

        {/* 'S' Handle Part (Looping on the left) */}
        <path
          d="M 238 210 
             C 185 220, 160 170, 190 135 
             C 215 105, 260 115, 240 148 
             C 225 170, 245 190, 256 195"
          fill="none"
          stroke="url(#chromeAngled)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* S-curve inner detail */}
        <path
          d="M 238 210 
             C 185 220, 160 170, 190 135 
             C 215 105, 260 115, 240 148 
             C 225 170, 245 190, 256 195"
          fill="none"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />

        {/* 'R' Handle Part (Looping on the right) */}
        {/* Integrated loop pointing right and down */}
        <path
          d="M 256 195
             C 265 190, 290 175, 285 150
             C 280 125, 240 120, 240 148
             M 264 168
             L 310 215"
          fill="none"
          stroke="url(#chromeGradient)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* R-curve inner detail */}
        <path
          d="M 256 195
             C 265 190, 290 175, 285 150
             C 280 125, 240 120, 240 148
             M 264 168
             L 310 215"
          fill="none"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />

        {/* Intertwining Ring on behind/front to reinforce infinity/loop key logo */}
        <circle
          cx="256"
          cy="125"
          r="36"
          fill="none"
          stroke="url(#chromeAngled)"
          strokeWidth="16"
          opacity="0.9"
        />
        <circle
          cx="256"
          cy="125"
          r="36"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
          opacity="0.5"
        />

        {/* 'F' Blade Part (Key bit projecting to the right) */}
        {/* Specifically shaped as a block F */}
        <path
          d="M 270 310 
             H 318 
             V 328 
             H 270
             M 270 346
             H 300
             V 364
             H 270"
          fill="url(#chromeGradient)"
          stroke="#1e293b"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        
        {/* Highlight details over Key Shaft and F */}
        <path
          d="M 271 313 H 315"
          stroke="#ffffff"
          strokeWidth="2"
          opacity="0.8"
        />
        <path
          d="M 271 349 H 297"
          stroke="#ffffff"
          strokeWidth="2"
          opacity="0.8"
        />
      </g>
    </svg>
  );
}
