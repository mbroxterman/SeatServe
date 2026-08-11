# SS-F-003 – Administration Dashboard

## Feature Information

**Feature ID:** SS-F-003

**Name:** Administration Dashboard

**Version:** 1.0.0

**Status:** Approved for Development

**Sprint:** Administration Sprint

**Priority:** Critical

---

# Purpose

The Administration Dashboard serves as the home screen for all administrators.

It provides immediate visibility into the current event and quick access to every administration function.

This dashboard will become the primary screen used by concession managers before, during, and after every event.

---

# User Story

As a concession manager,

I want one dashboard where I can immediately see the current event and access every administrative function,

so I can prepare and manage concession operations quickly.

---

# Business Rules

• The dashboard is available only to authenticated administrators.

• The dashboard always opens after administrator login.

• Every administration function is accessible from this page.

• The dashboard displays current event information.

• The dashboard displays operational statistics.

• The dashboard must be fully responsive.

• The dashboard must support both phones and tablets.

---

# Screen Layout

────────────────────────────

SeatServe Logo

Skip the line. Stay in the game.

Workspace Name

────────────────────────────

Today's Event

Current Event Name

Current Venue

Ordering Status

[ Start Event ]

────────────────────────────

Statistics

Orders Today

Available Runners

Ordering Status

Workspace

────────────────────────────

Administration

Event Setup

Menu Builder

Venue Manager

Zone Manager

Runner Manager

QR Manager

Reports

Settings

────────────────────────────

Version 3.0 Alpha

---

# Module Cards

Each administration function appears as a reusable Module Card.

Every Module Card contains:

• Icon

• Title

• Description

• Right Arrow

Example

🍔

Menu Builder

Create and edit menus, prices and modifiers.

Open →

---

# Statistics Cards

Statistics are displayed in a 2-column responsive grid.

Cards include:

Orders Today

Available Runners

Ordering

Workspace

Initially all statistics display placeholder values.

Later they become live.

---

# Current Event Card

Displays:

Today's Event

No Active Event

When no event exists.

Later this card displays:

Event Name

Venue

Menu

Delivery Fee

Ordering Status

Start Event button

---

# Navigation

Selecting a Module Card navigates to:

Event Setup

Menu Builder

Venue Manager

Zone Manager

Runner Manager

QR Manager

Reports

Settings

Pages may initially contain placeholder content.

---

# Components Required

AppHeader

ModuleCard

Dashboard

StatisticCard

EventCard

---

# Theme

Primary

Mill Valley Navy

Secondary

Silver

Background

White

Cards

White

Rounded Corners

Large Touch Targets

---

# Mobile Requirements

Minimum touch target

44px

Single column layout

Statistics automatically wrap

Module Cards occupy full width

---

# Tablet Requirements

Statistics become two columns.

Module Cards become two columns.

Header expands.

---

# Future Enhancements

Live Event

Weather

Notifications

Recent Activity

Quick Actions

Sponsor Banner

---

# Acceptance Criteria

✓ Dashboard loads

✓ Responsive

✓ SeatServe branding

✓ Statistics visible

✓ Current Event card visible

✓ Administration cards visible

✓ Navigation operational

✓ No console errors

✓ Mobile friendly

✓ Tablet friendly

---

# Files Included

src/components/AppHeader.tsx

src/components/ModuleCard.tsx

src/components/StatisticCard.tsx

src/components/EventCard.tsx

src/pages/administration/Dashboard.tsx

src/theme/colors.ts

src/App.tsx

---

# Git Commit

SS-F-003 Administration Dashboard

---

# Dependencies

Foundation Sprint completed.

No additional dependencies.
