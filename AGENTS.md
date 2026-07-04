# Agent Context & Rules

This document outlines specific guidelines and rules used by the AI agent during the development of this project.

## 1. Next.js App Router Rules
- **Rule Followed:** The agent recognized that this project utilizes the **Next.js App Router** (Next 13+).
- **Execution:** All backend API routes were placed inside `app/api/.../route.js` using the standard `export async function GET/POST` signature rather than the legacy `pages/api` structure. Client-side components were strictly isolated and marked with `"use client"`.

## 2. Drizzle ORM Constraints
- The agent was instructed to ensure valid mappings between Auth.js and Drizzle ORM.
- During implementation, a critical issue arose where the Auth.js `DrizzleAdapter` checks the database instance using `typeof` and internal property verification. 
- **Resolution:** The agent crafted a custom `Proxy` using `Object.create(null)` to mimic the exact structural signature required by the DrizzleAdapter while maintaining lazy initialization for successful build-time compilation.

## 3. UI/UX Rules
- **Rule Followed:** "Prioritize Visual Excellence" and "Use a Dynamic Design".
- **Execution:** The agent bypassed default Tailwind components to write a custom, premium design system in `globals.css` incorporating:
  - Glassmorphism (`backdrop-filter: blur()`).
  - Glowing gradients and hover effects.
  - Micro-animations (badges pulsing, forms sliding in).
  - Elegant skeleton loaders for async data fetching.
