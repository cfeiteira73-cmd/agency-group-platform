# PLAYBOOK — PERFORMANCE
**Agency Group | Premium experience = fast experience.**

## LOAD WITH
CONSTITUTION + CURRENT_STATE + THIS PLAYBOOK + CURRENT TASK

---

## TARGETS (important public pages)
- LCP ≤ 2.0s
- INP ≤ 200ms
- CLS ≤ 0.1
- Lighthouse ≥ 95

## NEVER SACRIFICE
- Image quality for score (use next/image with quality optimisation)
- Premium video/Matterport for CLS score
- Real property photos for faster but fake images

## BEFORE ANY PERFORMANCE CHANGE
1. Measure baseline (Lighthouse, WebPageTest)
2. Identify specific bottleneck
3. Implement targeted fix
4. Measure after — must improve, not just change

## PERFORMANCE BUDGET
- Total JS: < 200KB (gzipped)
- Images: next/image with WebP + lazy load
- Fonts: system stack preferred, 2 web fonts max
- Third-party scripts: audit quarterly

## MONITORING
- Vercel Analytics: Core Web Vitals in production
- Alert if LCP degrades > 20% vs baseline
