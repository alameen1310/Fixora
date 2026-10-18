# Fixora — Design Direction

## Purpose and status

This brief describes the visual identity, experience principles, and quality bar for Fixora. It is a direction for future design and implementation, not a rigid component-by-component blueprint or a claim that the described experience exists today. Design decisions should respond to the product context and the needs of the feature being built.

## Brand feeling

Fixora should feel modern and distinctive, premium without being pretentious, trustworthy and human, confident and welcoming, practical and dependable. It should be visually engaging and photo-rich, with a contemporary identity of its own.

The product should feel like a thoughtfully designed consumer marketplace. Avoid the look of a generic admin dashboard or a standard template with a new name applied.

## Starting colour palette

- Primary blue: `#2457D6`
- Dark blue: `#1946B8`
- Background: `#F6F7F9`
- Surface: `#FFFFFF`
- Primary text: `#17191D`
- Secondary text: `#686D76`
- Border: `#E4E7EC`
- Pale blue: `#EEF3FF`
- Success: `#23845B`

Use blue to establish recognition, guide important actions, and communicate confidence. White and neutral tones should keep information clear and readable. Reserve success green for meaningful success feedback or status. This palette is a foundation for a cohesive identity; introduce other colours only when they have a clear product or communication purpose.

## Visual direction

Give each page and section a deliberate point of view. Build visual hierarchy through composition, typography, imagery, contrast, and useful detail. Layouts should respond to their content and task rather than repeat one template everywhere. Keep the experience consistent across pages without making every page look identical.

Avoid generic AI-made SaaS patterns, bare interfaces without enough visual character, disconnected empty space, unreadably small text, repetitive grids of identical cards, and excessive use of pills. Avoid gradients, blobs, oversized shadows, generic illustrations, and decorative effects when they do not serve the content or experience. These are cautions, not blanket bans: use a card, shadow, gradient, rounded shape, or illustration when it has a clear purpose.

Do not equate premium design with enormous whitespace, tiny type, or an oversized hero. Make each screen balanced, useful, and visually confident.

## Typography, spacing, and layout

Do not treat this brief as a source of arbitrary pixel values, fixed spacing rules, or exact font sizes. Set measurements in context during design and implementation.

The interface should use readable type at real viewing sizes and create clear hierarchy between headings, supporting text, labels, and metadata. Spacing should feel balanced and intentional. Content density should suit the task, available space should be used effectively, and pages should have a coherent visual rhythm without forcing every section into the same proportions.

Responsive layouts should preserve readability and composition across screen sizes. Reorganize content where needed rather than merely shrinking a desktop layout.

## Photography and project imagery

Photography is central to Fixora because the product revolves around real household problems and completed work. Prefer relevant imagery that helps people understand the work and the people behind it, such as professionals at work, repairs and installations, tools and materials in context, before-and-after transformations, and finished projects.

Use images to explain, create visual interest, and support discovery. Do not add images merely as decoration. Use existing assets or suitable permitted sources, and verify external assets when the available tools allow. Do not use random, unrelated, broken, or fabricated image URLs. Represent illustrative or unverified content transparently.

## Motion

The interface should feel responsive and alive. Use purposeful, smooth movement when it clarifies a change, guides attention, or gives useful feedback. Suitable opportunities include page entrances, scroll reveals, navigation and control feedback, state transitions, and project-preview interactions.

Choose motion for the context. Do not animate every element, distract from content, or delay access to important actions. Keep motion performant, especially on mobile, and respect `prefers-reduced-motion`. Avoid gratuitous movement, excessive bouncing, long intro sequences, and gimmicks.

Animation libraries are allowed. Use CSS when it is sufficient; a library such as Motion for React may be used when it materially improves the quality, coherence, or maintainability of the experience. Do not reject a useful dependency solely to minimize dependency count.

## Interaction and accessibility

Interactions should feel responsive and intentional. Where relevant, buttons, links, navigation, forms, and controls should communicate hover, focus, active, loading, success, and error states. Interactive previews should behave like controls, and static content should not imply an action it cannot perform.

Use semantic, accessible controls and preserve keyboard navigation. Provide adequate contrast, readable typography, useful alternative text for images, and forms that clearly communicate their purpose. Error and empty states should help people understand what happened and what they can do next. A visually attractive interface is not successful if it is difficult to use.

## Responsive experience

The experience must adapt naturally to mobile, tablet, and desktop. Reconsider navigation, content order, image presentation, and interaction patterns at smaller sizes. Preserve hierarchy, readable type, useful content density, and comfortable touch interaction.

## App experience after the landing page

The established landing page is a protected marketing experience. The app-oriented design direction begins when someone enters registration and applies to subsequent product screens as they are built. Do not change the landing page's layout, styling, motion, or behavior while evolving the rest of the application.

Treat registration and future account experiences as deliberate mobile screens, with clear top-level navigation, touch-friendly controls, appropriate safe-area handling, readable forms, and a primary action that remains easy to reach without obstructing keyboard use. Do not add persistent bottom navigation to focused forms. Use a shared shell and interaction patterns where they support continuity, while adapting composition to each screen's purpose. Keep desktop layouts composed for wider screens rather than stretching the mobile view.

Use motion as a consistent language for transitions and feedback, not as decoration. Prefer short, responsive transitions; preserve browser history, focus, and reduced-motion preferences. Use the existing animation tooling where it already serves the experience. Translucent materials may be used sparingly for floating navigation or contextual surfaces, with readable contrast and a clear fallback.

Only design screens and interactions supported by the current product and implementation. Preserve existing registration requirements and validation, and never represent a local preview or unconnected form as a completed account or backend action.

## Component and styling architecture

For future UI work, use React and JSX with JavaScript, not TypeScript. A `src` directory may be organized around route-level pages, reusable components, project assets, and application entry points. Add folders when they provide a real organizational benefit; avoid hierarchy for its own sake.

Do not put an entire substantial page in `App.jsx`. Keep it focused on the app shell, route composition, or top-level orchestration. Place substantial pages in their own files and extract components when they have a clear purpose or are shared.

Keep component-specific styling near its component where practical. Use global styles for resets, base typography, design tokens, and genuinely global rules. Avoid one enormous stylesheet for every page, duplicated styling scattered across components, and abstractions that force unrelated elements together.

## GPT Taste skill

The installed `gpt-taste` skill was consulted while preparing this direction. Its instructions are highly specific to building interfaces: they require a preflight design plan and define randomized layout selection, an AIDA page structure, image-led composition, gapless bento grids, and GSAP-based motion patterns, with reduced-motion handling. Those instructions should be consulted directly when the skill is used for future interface work; this brief does not restate them as universal requirements for every Fixora screen. Apply the relevant guidance in the context of the feature and the product principles above. Do not claim the skill was used for implementation unless it was actually invoked for that work.

## Quality bar

The product should feel intentionally designed, distinctive, polished, responsive, and trustworthy. Give each feature visual attention in proportion to its importance. Every major design decision should serve the product, the content, the brand, or the user's task. Quality means more than technical correctness, and decoration alone does not make an experience better.

## Mobile app foundation

The installed app uses the same Fixora identity as public entry points: the house mark and `fixora` wordmark, the blue-and-white palette, and readable Satoshi-first typography with platform system fallbacks. Use a light cool-grey grouped background with white elevated surfaces, pale-blue tonal surfaces, and hairline separators so information groups remain clear without heavy decoration.

Use shared primitives for buttons, icon buttons, inputs, grouped lists, account-type controls, chips, avatars, badges, skeletons, empty states, toasts, and action sheets. Primary actions should be at least 52px high; all other interactive controls must keep a 44px target. Use visible focus states, immediate pressed feedback, safe-area padding, and `100dvh` layouts where a screen fills the device.

Use restrained depth: two soft blue-tinted shadows and a 10/14/20/28px radius scale. Keep copy in sentence case and do not use warning treatment for information that does not require action. Motion uses 120/220/350ms durations with `cubic-bezier(0.2, 0, 0, 1)` as the standard curve and `cubic-bezier(0.32, 0.72, 0, 1)` for sheets; reduced-motion users receive static or opacity-only feedback.
