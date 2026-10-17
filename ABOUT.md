# Fixora — Product Brief

> Fixora is a temporary product name.

## Product vision

Fixora is a household-services marketplace built around social discovery. It connects people who need domestic work done with skilled professionals who can show what they do, build a visible track record, and find customers.

The product should make it easier to go from a real household problem to a suitable professional. It should also give professionals useful ways to demonstrate their abilities and earn trust. Discovery through problems, completed projects, portfolios, and reviews is central to that experience; Fixora is not just a list of names and phone numbers.

This document describes the product vision and intended direction. It does not claim that the features below have been implemented.

## Who Fixora serves

### Customers

People who need household services, repairs, installations, maintenance, or other relevant domestic work. They need to explain what is wrong, find capable professionals, evaluate their work and feedback, compare applicants, and manage the job.

### Service professionals

Technicians, repairers, installers, and other skilled workers who provide household services. They need to present their skills and completed work, reach relevant customers, apply for suitable jobs, manage accepted work, and build a reputation over time.

## The problem

Customers can have a hard time finding reliable professionals, judging the quality of their work, and knowing whom to trust before hiring. Professionals with strong skills may have limited visibility and few good ways to demonstrate their abilities, build a reputation, or connect with potential customers.

Fixora aims to connect real customer needs with demonstrated skills and informative professional profiles. Useful work, relevant details, and reviews should help both sides make better decisions.

## How it is intended to work

The intended experience links a customer request to professional discovery, selection, job progress, completed work, and feedback. Visual project content helps people discover that work and the professionals behind it.

### Customer problem posting

Customers should be able to describe a household problem, add photographs where useful, select a relevant category, and optionally provide location, budget, or urgency. They should be able to review professionals who apply and choose someone suitable.

### Professional discovery and applications

Professionals should be able to discover relevant problems and service opportunities, assess whether a request suits their skills and service area, and apply. Customers should be able to evaluate applicants using relevant profile details, portfolios, and reviews.

Customers should also be able to discover professionals through their profiles and showcased work. Profiles are intended to communicate skills, experience, service areas, completed projects, and reviews.

### Job management and reputation

After a customer selects a professional, both sides should be able to track job status and manage the working relationship. Customers should be able to mark work complete and leave a review. Over time, completed work and reviews should contribute to a professional's visible track record.

### Social discovery feed

A visual feed should showcase unresolved household problems and completed projects. Photography should make the situation, work, or result understandable. People should be able to follow project content to relevant professional profiles, portfolios, and reviews.

The feed exists to improve discovery, show skills, build trust, and create opportunities for customers and professionals. It is part of the marketplace experience, not a separate general-purpose social network.

## What makes Fixora distinct

Fixora brings together three connected experiences:

- **Marketplace:** find and hire household-service professionals.
- **Job workflow:** connect customers and suitable professionals from request through completion and review.
- **Visual discovery:** make real problems, completed work, and professional capabilities easier to discover.

The connections between these experiences matter. Project content can help a customer recognize relevant expertise; a profile can give context to that work; reviews can add useful feedback; and requests can create opportunities for professionals.

## Product principles

- **Earn trust:** use visible work, useful information, and reviews to support credibility.
- **Make discovery clear:** help people understand what they are seeing and what they can do next.
- **Serve both sides:** support customers looking for help and professionals building their business.
- **Prioritize usefulness:** favor features that solve real needs over feature count.
- **Treat presentation as meaningful:** photography and project context help people understand the work.
- **Be transparent:** distinguish real, verified, illustrative, and not-yet-available information.
- **Design for access:** make the experience responsive, accessible, and easy to understand.
- **Build incrementally:** validate each feature before expanding the product's scope.

## Intended technical direction

The current architectural intentions are React, Vite, and JavaScript with JSX, with Supabase as the intended backend for database, authentication, and storage, and Cloudflare Pages as the intended frontend hosting platform. A progressive web app experience may be introduced later.

These are planning decisions, not authorization to scaffold or integrate the stack. They do not imply that any of these services are configured or in use.

## Development philosophy

Future implementation should proceed one feature at a time:

1. Understand the relevant product context.
2. Inspect the existing code and project instructions.
3. Implement the requested scope.
4. Reuse components and patterns where they fit.
5. Test the work with available tools.
6. Report what changed and any known limitations.
7. Stop for review before moving to another feature.

Do not attempt to build the entire marketplace in one pass. Avoid premature abstractions and unnecessary dependencies, while maintaining a high quality bar. AI tools may assist with development; that does not mean the product itself needs AI features.
