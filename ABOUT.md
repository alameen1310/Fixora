# Fixora — Product Overview

## Product overview

Fixora is a household-services marketplace with a social discovery feed. It connects people who need household problems solved with skilled professionals who can solve them.

The product brings together two experiences:

- A marketplace for posting household problems and finding service providers.
- A social discovery experience for exploring real household problems, completed projects, before-and-after photos, and the professionals responsible for the work.

Fixora is a temporary product name. Keep the name easy to change later.

## The problem Fixora solves

People often struggle to find reliable professionals for household repairs and maintenance. They may not know whom to trust, how to compare workers, or where to find evidence of previous work. Skilled workers also struggle to gain visibility, demonstrate their abilities, and find customers.

Fixora aims to make these connections easier through real job requests, provider applications, professional profiles, portfolios, and customer reviews.

## User types

### Customers

Customers are people who need household services. They can:

- Browse the discovery feed.
- Post a household problem with a description, photos, and service category.
- Optionally provide relevant information such as location, budget, and urgency.
- Receive applications from service providers.
- Review provider profiles, portfolios, and reviews.
- Select a suitable provider.
- Track or manage their requests.
- Mark work as completed and review the provider.

### Service providers

Service providers are skilled professionals offering household services, such as plumbing, electrical repairs, painting, carpentry, and appliance repairs. They can:

- Create a professional profile.
- Select their skills and service categories.
- Specify relevant service areas.
- Discover relevant job requests.
- Apply for jobs.
- Manage their applications and accepted jobs.
- Showcase completed projects through photos and portfolio entries.
- Build credibility through customer reviews.

Do not assume every user must permanently belong to only one category. Whether a single account can act as both a customer and a provider is a product decision that must be resolved before implementing authentication and role management.

## Main product experience

### Job discovery and posting

Customers publish household problems. Providers can discover relevant requests through a feed or service filters and submit applications.

### Provider selection

Customers review applicants and their profiles, work samples, and reviews before choosing a provider.

### Job completion

The customer and provider arrange and complete the work. The platform should support an appropriate way to represent job status, completed work, and customer feedback.

In-app payments, real-time tracking, dispute resolution, and sophisticated scheduling are not assumed to be first-version requirements.

### Social discovery

The feed can display unresolved household problems and completed projects. A completed project can feature before-and-after photos, details of the work, the responsible provider, and customer feedback. Users should be able to discover a provider through a completed project and explore their profile.

## Product principles

- Support trust with useful evidence, not unsupported claims.
- Make posting a problem and finding help straightforward.
- Help providers demonstrate real skills and completed work.
- Make the social feed useful for discovering services, not merely scrolling.
- Keep the experience accessible and easy to understand.
- Prioritise useful functionality over unnecessary features.
- Clearly distinguish implemented features from planned functionality.

## Initial product scope

Fixora is a hackathon project with limited development time. The initial product should be a coherent minimum viable product (MVP). Candidate capabilities include:

- Landing page or first-visit experience.
- Customer and provider onboarding.
- Discovery feed.
- Problem posting.
- Provider profiles and portfolios.
- Job applications and customer selection.
- Job status and completed projects.
- Customer reviews.

These are candidate features, not a requirement to implement everything immediately. The MVP and build order will be decided separately.

Potential future features include messaging, notifications, advanced search, saved posts, likes, comments, payments, identity verification, and additional trust and safety controls. Do not present planned features as already implemented.

## AI usage

AI tools may assist development during the hackathon. This does not mean the finished product must contain AI-powered features. Do not add AI functionality to the product unless explicitly decided.

## Technical direction

The intended stack is:

- React.
- Vite.
- JavaScript and JSX only.
- Plain CSS with reusable styles and CSS custom properties.
- Supabase for backend services, authentication, database, and initial file storage.
- Cloudflare Pages for frontend hosting.
- Progressive Web App (PWA) support, allowing installation on compatible devices.

The PWA should be mobile-friendly. Installability does not automatically imply complete offline functionality. Keep architecture simple. Do not add Convex, Better Auth, or Cloudflare R2 alongside Supabase without an explicit architectural decision.

## Development workflow

- Implement the product incrementally.
- Work only on the feature explicitly requested in each task.
- Inspect existing files before making changes.
- Preserve working code and existing decisions.
- Do not implement the whole product in one task.
- Test each meaningful change before proceeding.
- Use conventional commit messages, such as `feat: add problem posting form`, `fix: correct provider filtering`, and `style: refine mobile navigation`.
- Provide the proposed commit message, but never commit or push automatically unless explicitly instructed.
- Do not introduce TypeScript.
