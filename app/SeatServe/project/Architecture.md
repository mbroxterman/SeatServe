Architecture

Project: SeatServe

Tagline: Skip the line. Stay in the game.

Version: 3.0 Alpha

Status: Draft

Last Updated: 2026-08-04

Pilot Customer: Mill Valley High School Booster Club

1. Purpose

This document defines the overall software architecture for SeatServe.

Its purpose is to ensure that every future feature is built on a consistent, scalable foundation and that future developers understand how the application is intended to function.

This document should be considered the architectural source of truth for SeatServe.

2. Vision

SeatServe is a mobile-first Progressive Web App (PWA) that allows spectators to order concessions directly from their seats while providing kitchen, runner, and administrative tools that improve concession operations and increase booster club revenue.

SeatServe is designed to operate first as a pilot at Mill Valley High School and later expand into a configurable platform that can support multiple schools.

3. Design Principles

SeatServe follows these core principles.

3.1 Mobile First

Every screen is designed for a cellphone first.

Desktop layouts are adaptations of the mobile experience.

3.2 Customer Web Only

Customers never download an application.

They simply:

Scan QR Code
Order
Track
Receive Food
3.3 Kitchen Is the Source of Truth

The Kitchen Dashboard owns every order.

Orders never disappear.

They progress through the workflow until archived.

3.4 Three Tap Rule

Primary workflows should require no more than three taps whenever practical.

Examples:

Runner

Accept

↓

Arriving Now

↓

Delivered

3.5 Configuration Never Lives in Code

Menus

Venues

Zones

Runner Lists

Settings

Delivery Fees

QR Assignments

are stored as configuration data—not inside the application.

3.6 Consistent Branding

SeatServe is the product.

SeatBeacon™ is a feature of SeatServe.

The SeatServe logo remains the primary brand throughout the application.

4. High-Level Architecture
                        SeatServe

                Progressive Web App (PWA)

                           │

     ┌──────────────┬───────────────┬──────────────┐

     │              │               │              │

 Customer       Kitchen         Runner      Administration

     │              │               │              │

     └──────────────┴───────────────┴──────────────┘

                           │

                  Business Services Layer

                           │

     ┌─────────────────────────────────────────────┐

     │                                             │

 Orders

 Menus

 Reporting

 Analytics

 SeatBeacon™

 QR Generator

 Authentication

 Storage Provider

     │                                             │

     └─────────────────────────────────────────────┘

                           │

                 Storage Provider Interface

                           │

     ┌───────────────┬──────────────────────┐

     │               │                      │

 Local Storage    Google Drive        Future Providers
5. Applications

SeatServe consists of one application that provides four role-based experiences.

Customer

Purpose

Allows spectators to order concessions.

Capabilities

Scan QR Code
Order food
Customize items
Track order
SeatBeacon™
Rate experience

Authentication

None

Kitchen

Purpose

Manage active food preparation.

Capabilities

Event Setup Wizard
Kitchen Display System
Runner Manager
Order Management
Kitchen Analytics

Authentication

Kitchen PIN

Runner

Purpose

Deliver orders.

Capabilities

Sign in
Accept Delivery
Pick Up Order
Arriving Now
Delivered
SeatBeacon Status

Authentication

Staff QR

↓

Runner Name

Administration

Purpose

Configure SeatServe.

Capabilities

Dashboard
Menu Builder
Venue Manager
Zone Manager
Runner Manager
QR Manager
Reports
Settings
Backup & Restore

Authentication

Administrator PIN

6. Workspace

Every organization operates inside a Workspace.

Examples

Development

Mill Valley High School Booster Club

A Workspace owns:

Menus
Venues
Zones
Events
Reports
Settings
Runners
Images

Switching workspaces changes all configuration without changing the application.

7. Storage Architecture

SeatServe communicates only with the Storage Provider.

The application never communicates directly with Google Drive or browser storage.

Supported Providers

Local Provider

Used during development and pilot testing.

Google Drive Provider

Production storage.

Future Providers
Firebase
SQL
Azure
BoosterHub
8. Order Lifecycle

Every order follows the same lifecycle.

Received

↓

Preparing

↓

Ready for Runner

↓

Assigned

↓

Out for Delivery

↓

Arriving Now

↓

Delivered

↓

Archived

Orders remain visible in the Kitchen Dashboard throughout their lifecycle.

Delivered orders move into a collapsed history section.

9. Runner Assignment

SeatServe automatically assigns the next available runner.

Assignment Rules

Available
Longest Idle
Fewest Active Deliveries

Kitchen staff may override assignments at any time.

10. SeatBeacon™

SeatBeacon™ is part of SeatServe.

Customer Options

Flash Screen
Wave Phone

Flash Screen displays:

SeatServe logo
Animated jaguar claw marks
Navy/Silver alternating background

When Delivered is pressed:

SeatBeacon stops
Thank You screen appears
Customer Rating appears
11. Event Setup Wizard

Every event begins with Event Setup.

Configuration includes:

Venue
Event
Menu
Delivery Options
Pickup Location
Delivery Fee
Runner Availability
Ordering Status

No customer ordering is allowed until the event is opened.

12. Configuration Data

Configuration changes infrequently.

Includes:

Menus
Menu Items
Prices
Venues
Zones
Pickup Locations
Delivery Fees
Runner List
Event Templates
13. Operational Data

Operational data changes continuously.

Includes:

Orders
Runner Status
Customer Tracking
Ratings
Analytics
Reports

Configuration and operational data are always stored separately.

14. Analytics

Pilot analytics include:

Total Orders
Gross Sales
Average Delivery Time
Average Wait Time
Runner Performance
Sales by Venue
Menu Performance
Delivery Fee Totals
Customer Ratings
Pickup vs Seat Delivery

These analytics are generated automatically from operational data.

15. Reporting

Administration can export:

Excel
CSV
PDF

Reports include:

Sales
Orders
Menu Performance
Runner Performance
Customer Feedback
Event Summary
16. Future Integrations

The architecture supports future integrations without changing application behavior.

Planned integrations include:

Google Drive
BoosterHub
Square
Stripe

Integrations are implemented as providers and services rather than hard-coded features.

17. Architectural Decisions

The following decisions govern the project.

Customer uses a web application only.
Kitchen Dashboard is the source of truth.
Orders never disappear from the kitchen workflow.
Runner assignment is automatic using the next available runner.
SeatBeacon™ is a SeatServe feature.
Configuration is never stored inside application code.
Administration is the only place configuration is edited.
Mobile-first design governs all UI decisions.
SeatServe branding remains consistent across all modules.
18. Future Enhancements

Planned enhancements include:

Google Drive Workspace synchronization
BoosterHub payment integration
Push notifications
Inventory assistance
Sponsor management
Multi-school support
Advanced analytics
AI delivery predictions

These features are outside the scope of the initial football pilot.

Revision History
Version	Date	Description
3.0 Alpha	2026-08-04	Initial Architecture Document
