# Fixora — Visual Design Specification

This document is the initial visual source of truth for Fixora. Read and follow it before making UI changes. Extend the existing design system rather than inventing new styles on every screen. Update this file only when an intentional design decision changes, and keep visual changes within the current task's scope. Do not build unrequested pages or components.

## Brand personality

Fixora should feel trustworthy, modern, practical, human, premium without feeling exclusive, and social and discovery-oriented while remaining a credible service marketplace.

It should not look like a generic admin dashboard, a generic AI-generated SaaS template, or a clone of a conventional social network.

## Colour palette

Use these initial design tokens:

| Token | Value | Intended use |
| --- | --- | --- |
| Primary blue | `#2457D6` | Primary actions, active navigation, links, meaningful highlights |
| Dark blue | `#1946B8` | Deeper blue states where needed |
| Main background | `#F6F7F9` | Page background |
| Surface | `#FFFFFF` | Content surfaces |
| Primary text | `#17191D` | Main text |
| Secondary text | `#686D76` | Supporting text and metadata |
| Borders | `#E4E7EC` | Dividers and restrained outlines |
| Pale blue | `#EEF3FF` | Subtle blue-tinted highlights |
| Success | `#23845B` | Successful outcomes and status |

Use blue selectively. Maintain strong contrast and avoid making every element blue. Implement shared colours and other design tokens with CSS custom properties.

## Typography

- Use a clean sans-serif typeface such as Inter, with a suitable system-font fallback.
- Establish a clear hierarchy between page titles, section headings, body text, labels, and metadata.
- Use readable font sizes and comfortable line heights.
- Avoid oversized headings that consume too much space on mobile.
- Keep labels and supporting text legible.

## Layout and spacing

- Use a consistent spacing scale based on multiples of 4px.
- Align elements carefully and maintain clear visual hierarchy.
- Prefer whitespace over unnecessary decorative elements.
- Use consistent content widths and responsive gutters.
- Use restrained borders and subtle shadows only where they improve hierarchy.
- Use modest corner radii, generally around 8–12px, with larger radii only when justified.
- Avoid wrapping every piece of content in a separate card.

## Product-specific visual direction

Fixora is a photo-rich household-services marketplace.

- Use real-looking household repair and home improvement imagery where appropriate.
- Treat photos of actual work as important content, not decoration.
- Make problem posts and completed projects easy to distinguish.
- Design provider profiles around skills, experience, portfolios, and customer feedback.
- Give job status and application status clear visual treatments.
- Keep the interface useful and scannable even when users have many posts to browse.
- Use a consistent icon library if one is introduced later; do not use emojis as interface icons.

## Navigation and responsive behaviour

- Design mobile and desktop experiences deliberately.
- On desktop, use a layout appropriate to the current page rather than forcing every page into the same dashboard structure.
- A feed may use a central content column and restrained supporting sidebars where useful.
- On mobile, prioritise the main task and avoid cramped multi-column layouts.
- Navigation should be predictable, with clearly indicated active states.
- Forms must remain comfortable to complete on touchscreens.
- Buttons and interactive controls must have appropriate touch targets.
- Do not assume that a desktop sidebar should simply shrink onto mobile.

## Components

Establish consistent treatments for:

- Primary, secondary, and text buttons.
- Form inputs, labels, helper text, and validation errors.
- Navigation links and active states.
- Problem posts and completed-project posts.
- Provider profile summaries.
- Application and job status indicators.
- Empty states, loading states, and error states.
- Confirmation dialogs and feedback messages when needed.

Components should be reusable where doing so improves consistency, but avoid premature abstraction.

## Accessibility

- Use semantic HTML.
- Ensure keyboard accessibility and visible focus states.
- Associate form labels with their inputs.
- Provide useful alternative text for meaningful images.
- Do not communicate status through colour alone.
- Maintain adequate contrast and readable text.
- Respect reduced-motion preferences if animations are introduced.

## Explicit anti-patterns

Avoid:

- Unnecessary gradients and decorative blobs.
- Excessive pill-shaped buttons and tags.
- Oversized shadows and glassmorphism used without purpose.
- Generic dashboard cards everywhere.
- Excessive blue backgrounds.
- Arbitrary spacing and inconsistent radii.
- Fake functionality and dead buttons presented as working.
- Decorative animations that interfere with usability.
- Broken external image URLs or unlicensed assets.
- Unnecessary dependencies added solely for appearance.
- Inconsistent styles across pages.

## Design implementation rules

- Treat this file as the initial visual source of truth.
- Read and follow it before making UI changes.
- Extend the existing design system rather than inventing new styles on every screen.
- Update this file only when an intentional design decision changes.
- Use CSS custom properties for shared colours and other design tokens.
- Keep visual changes within the scope of the current task.
- Do not build pages or components that have not been requested.
